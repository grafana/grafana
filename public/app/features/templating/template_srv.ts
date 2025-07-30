import { escape, isString } from 'lodash';

import {
  deprecationWarning,
  ScopedVars,
  TimeRange,
  AdHocVariableFilter,
  AdHocVariableModel,
  TypedVariableModel,
  ScopedVar,
} from '@grafana/data';
import {
  getDataSourceSrv,
  setTemplateSrv,
  TemplateSrv as BaseTemplateSrv,
  VariableInterpolation,
} from '@grafana/runtime';
import { sceneGraph, VariableCustomFormatterFn, SceneObject } from '@grafana/scenes';
import { VariableFormatID } from '@grafana/schema';

import { getVariablesCompatibility } from '../dashboard-scene/utils/getVariablesCompatibility';
import { variableAdapters } from '../variables/adapters';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../variables/constants';
import { isAdHoc } from '../variables/guard';
import { getFilteredVariables, getVariables, getVariableWithName } from '../variables/state/selectors';
import { variableRegex } from '../variables/utils';

import { getFieldAccessor } from './fieldAccessorCache';
import { formatVariableValue } from './formatVariableValue';
import { macroRegistry } from './macroRegistry';

/**
 * Internal regex replace function
 */
type ReplaceFunction = (fullMatch: string, variableName: string, fieldPath: string, format: string) => string;

export interface TemplateSrvDependencies {
  getFilteredVariables: typeof getFilteredVariables;
  getVariables: typeof getVariables;
  getVariableWithName: typeof getVariableWithName;
}

const runtimeDependencies: TemplateSrvDependencies = {
  getFilteredVariables,
  getVariables,
  getVariableWithName,
};

export class TemplateSrv implements BaseTemplateSrv {
  private _variables: any[];
  private regex = variableRegex;
  private index: any = {};
  private grafanaVariables = new Map<string, any>();
  private _timeRange?: TimeRange | null = null;
  private _adhocFiltersDeprecationWarningLogged = new Map<string, boolean>();

  constructor(private dependencies: TemplateSrvDependencies = runtimeDependencies) {
    this._variables = [];
  }

  init(variables: any, timeRange?: TimeRange) {
    this._variables = variables;
    this._timeRange = timeRange;
    this.updateIndex();
  }

  /**
   * @deprecated: this instance variable should not be used and will be removed in future releases
   *
   * Use getVariables function instead
   */
  get variables(): TypedVariableModel[] {
    deprecationWarning('template_srv.ts', 'variables', 'getVariables');
    return this.getVariables();
  }

  getVariables(): TypedVariableModel[] {
    // For scenes we have this backward compatiblity translation
    if (window.__grafanaSceneContext) {
      return getVariablesCompatibility(window.__grafanaSceneContext);
    }

    return this.dependencies.getVariables();
  }

  get timeRange(): TimeRange | null | undefined {
    if (window.__grafanaSceneContext && window.__grafanaSceneContext.isActive) {
      const sceneTimeRange = sceneGraph.getTimeRange(window.__grafanaSceneContext);

      return sceneTimeRange.state.value;
    }

    return this._timeRange;
  }

  updateIndex() {
    const existsOrEmpty = (value: unknown) => value || value === '';

    this.index = this._variables.reduce((acc, currentValue) => {
      if (currentValue.current && (currentValue.current.isNone || existsOrEmpty(currentValue.current.value))) {
        acc[currentValue.name] = currentValue;
      }
      return acc;
    }, {});

    if (this.timeRange) {
      const from = this.timeRange.from.valueOf().toString();
      const to = this.timeRange.to.valueOf().toString();

      this.index = {
        ...this.index,
        ['__from']: {
          current: { value: from, text: from },
        },
        ['__to']: {
          current: { value: to, text: to },
        },
      };
    }
  }

  updateTimeRange(timeRange: TimeRange) {
    this._timeRange = timeRange;
    this.updateIndex();
  }

  variableInitialized(variable: any) {
    this.index[variable.name] = variable;
  }

  /**
   * @deprecated
   * Use filters property on the request (DataQueryRequest) or if this is called from
   * interpolateVariablesInQueries or applyTemplateVariables it is passed as a new argument
   **/
  getAdhocFilters(datasourceName: string, skipDeprecationWarning?: boolean): AdHocVariableFilter[] {
    let filters: AdHocVariableFilter[] = [];
    let ds = getDataSourceSrv().getInstanceSettings(datasourceName);

    if (!ds) {
      return [];
    }

    if (!skipDeprecationWarning && !this._adhocFiltersDeprecationWarningLogged.get(ds.type)) {
      if (process.env.NODE_ENV !== 'test') {
        deprecationWarning(
          `DataSource ${ds.type}`,
          'templateSrv.getAdhocFilters',
          'filters property on the request (DataQueryRequest). Or if this is called from interpolateVariablesInQueries or applyTemplateVariables it is passed as a new argument'
        );
      }
      this._adhocFiltersDeprecationWarningLogged.set(ds.type, true);
    }

    for (const variable of this.getAdHocVariables()) {
      const variableUid = variable.datasource?.uid;

      if (variableUid === ds.uid) {
        filters = filters.concat(variable.filters);
      } else if (variableUid?.indexOf('$') === 0) {
        if (this.replace(variableUid) === ds.uid) {
          filters = filters.concat(variable.filters);
        }
      }
    }

    return filters;
  }

  setGrafanaVariable(name: string, value: any) {
    this.grafanaVariables.set(name, value);
  }

  /**
   * @deprecated: setGlobalVariable function should not be used and will be removed in future releases
   *
   * Use addVariable action to add variables to Redux instead
   */
  setGlobalVariable(name: string, variable: any) {
    deprecationWarning('template_srv.ts', 'setGlobalVariable', '');
    this.index = {
      ...this.index,
      [name]: {
        current: variable,
      },
    };
  }

  getVariableName(expression: string) {
    this.regex.lastIndex = 0;
    const match = this.regex.exec(expression);
    if (!match) {
      return null;
    }
    const variableName = match.slice(1).find((match) => match !== undefined);
    return variableName;
  }

  containsTemplate(target: string | undefined): boolean {
    if (!target) {
      return false;
    }

    // Scenes compatability
    if (window.__grafanaSceneContext && window.__grafanaSceneContext.isActive) {
      // We are just checking that this is a valid variable reference, and we are not looking up the variable
      this.regex.lastIndex = 0;
      const match = this.regex.exec(target);
      return !!match;
    }

    const name = this.getVariableName(target);
    const variable = name && this.getVariableAtIndex(name);
    return variable !== null && variable !== undefined;
  }

  variableExists(expression: string): boolean {
    deprecationWarning('template_srv.ts', 'variableExists', 'containsTemplate');
    return this.containsTemplate(expression);
  }

  highlightVariablesAsHtml(str: string) {
    if (!str || !isString(str)) {
      return str;
    }

    str = escape(str);
    return this._replaceWithVariableRegex(str, undefined, (match, variableName) => {
      if (this.getVariableAtIndex(variableName)) {
        return '<span class="template-variable">' + match + '</span>';
      }
      return match;
    });
  }

  getAllValue(variable: any) {
    if (variable.allValue) {
      return variable.allValue;
    }
    const values = [];
    for (let i = 1; i < variable.options.length; i++) {
      values.push(variable.options[i].value);
    }
    return values;
  }

  private getVariableValue(scopedVar: ScopedVar, fieldPath: string | undefined) {
    if (fieldPath) {
      return getFieldAccessor(fieldPath)(scopedVar.value);
    }

    return scopedVar.value;
  }

  private getVariableText(scopedVar: ScopedVar, value: any) {
    if (scopedVar.value === value || typeof value !== 'string') {
      return scopedVar.text;
    }

    return value;
  }

  replace(
    target?: string,
    scopedVars?: ScopedVars,
    format?: string | Function | undefined,
    interpolations?: VariableInterpolation[]
  ): string {
    // Scenes compatability (primary method) is via SceneObject inside scopedVars. This way we get a much more accurate "local" scope for the evaluation
    if (scopedVars && scopedVars.__sceneObject) {
      // We are using valueOf here as __sceneObject can be after scenes 5.6.0 a SafeSerializableSceneObject that overrides valueOf to return the underlying SceneObject
      const sceneObject: SceneObject = scopedVars.__sceneObject.value.valueOf();
      return sceneGraph.interpolate(
        sceneObject,
        target,
        scopedVars,
        format as string | VariableCustomFormatterFn | undefined,
        interpolations
      );
    }

    // Scenes compatability: (secondary method) is using the current active scene as the scope for evaluation.
    if (window.__grafanaSceneContext && window.__grafanaSceneContext.isActive) {
      return sceneGraph.interpolate(
        window.__grafanaSceneContext,
        target,
        scopedVars,
        format as string | VariableCustomFormatterFn | undefined,
        interpolations
      );
    }

    if (!target) {
      return target ?? '';
    }

    this.regex.lastIndex = 0;

    return this._replaceWithVariableRegex(target, format, (match, variableName, fieldPath, fmt) => {
      const value = this._evaluateVariableExpression(match, variableName, fieldPath, fmt, scopedVars);

      // If we get passed this interpolations map we will also record all the expressions that were replaced
      if (interpolations) {
        interpolations.push({ match, variableName, fieldPath, format: fmt, value, found: value !== match });
      }

      return value;
    });
  }

  private _evaluateVariableExpression(
    match: string,
    variableName: string,
    fieldPath: string,
    format: string | VariableCustomFormatterFn | undefined,
    scopedVars: ScopedVars | undefined
  ) {
    const variable = this.getVariableAtIndex(variableName);
    const scopedVar = scopedVars?.[variableName];

    if (scopedVar) {
      const value = this.getVariableValue(scopedVar, fieldPath);
      const text = this.getVariableText(scopedVar, value);

      if (value !== null && value !== undefined) {
        return formatVariableValue(value, format, variable, text);
      }
    }

    if (!variable) {
      const macro = macroRegistry[variableName];
      if (macro) {
        return macro(match, fieldPath, scopedVars, format);
      }

      return match;
    }

    if (format === VariableFormatID.QueryParam || isAdHoc(variable)) {
      const value = variableAdapters.get(variable.type).getValueForUrl(variable);
      const text = isAdHoc(variable) ? variable.id : variable.current.text;

      return formatVariableValue(value, format, variable, text);
    }

    const systemValue = this.grafanaVariables.get(variable.current.value);
    if (systemValue) {
      return formatVariableValue(systemValue, format, variable);
    }

    let value = variable.current.value;
    let text = variable.current.text;

    if (this.isAllValue(value)) {
      value = this.getAllValue(variable);
      text = ALL_VARIABLE_TEXT;
      // skip formatting of custom all values unless format set to text or percentencode
      if (variable.allValue && format !== VariableFormatID.Text && format !== VariableFormatID.PercentEncode) {
        return this.replace(value);
      }
    }

    if (fieldPath) {
      const fieldValue = this.getVariableValue({ value, text }, fieldPath);
      if (fieldValue !== null && fieldValue !== undefined) {
        return formatVariableValue(fieldValue, format, variable, text);
      }
    }

    return formatVariableValue(value, format, variable, text);
  }

  /**
   * Tries to unify the different variable format capture groups into a simpler replacer function
   */
  private _replaceWithVariableRegex(text: string, format: string | Function | undefined, replace: ReplaceFunction) {
    this.regex.lastIndex = 0;

    return text.replace(this.regex, (match, var1, var2, fmt2, var3, fieldPath, fmt3) => {
      const variableName = var1 || var2 || var3;
      const fmt = fmt2 || fmt3 || format;
      return replace(match, variableName, fieldPath, fmt);
    });
  }

  isAllValue(value: unknown) {
    return value === ALL_VARIABLE_VALUE || (Array.isArray(value) && value[0] === ALL_VARIABLE_VALUE);
  }

  replaceWithText(target: string, scopedVars?: ScopedVars) {
    deprecationWarning('template_srv.ts', 'replaceWithText()', 'replace(), and specify the :text format');
    return this.replace(target, scopedVars, 'text');
  }

  private getVariableAtIndex(name: string) {
    if (!name) {
      return;
    }

    if (!this.index[name]) {
      return this.dependencies.getVariableWithName(name);
    }

    return this.index[name];
  }

  private getAdHocVariables(): AdHocVariableModel[] {
    return this.dependencies.getFilteredVariables(isAdHoc) as AdHocVariableModel[];
  }
}

// Expose the template srv
const srv = new TemplateSrv();

setTemplateSrv(srv);

export const getTemplateSrv = () => srv;
