import { escape, isString } from 'lodash';

import {
  AdHocVariableFilter,
  AdHocVariableModel,
  ScopedVar,
  ScopedVars,
  TimeRange,
  TypedVariableModel,
  dateTimeFormat,
  deprecationWarning,
  rangeUtil,
} from '@grafana/data';
import {
  TemplateSrv as BaseTemplateSrv,
  VariableInterpolation,
  config,
  getDataSourceSrv,
  setTemplateSrv,
} from '@grafana/runtime';
import { SceneObject, VariableCustomFormatterFn, sceneGraph } from '@grafana/scenes';
import { VariableFormatID } from '@grafana/schema';
import { getState } from 'app/store/store';

import { getVariablesCompatibility } from '../dashboard-scene/utils/getVariablesCompatibility';
import { getTimeSrv } from '../dashboard/services/TimeSrv';
import { getFeatureStatus } from '../dashboard/services/featureFlagSrv';
import { variableAdapters } from '../variables/adapters';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, NONE_VARIABLE_TEXT } from '../variables/constants';
import { isAdHoc } from '../variables/guard';
import { getFilteredVariables, getVariableWithName, getVariables } from '../variables/state/selectors';
import { dateRangeExtract, variableRegex } from '../variables/utils';

import { getFieldAccessor } from './fieldAccessorCache';
import { containsSingleQuote, formatVariableValue } from './formatVariableValue';
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

  // BMC changes - update function definition, emptyValue & customAllValue parameters added
  private _formatVariableValueBMC(
    value: any,
    format: string | Function | undefined,
    partialVar: any,
    scopeVars?: ScopedVars,
    emptyValue?: string,
    customAllValue?: boolean
  ) {
    // for some scopedVars there is no variable
    if (scopeVars && scopeVars.hasOwnProperty(partialVar.name)) {
      return typeof format === 'function' ? format?.(value, partialVar) : value;
    }
    const variable = this.getVariableAtIndex(partialVar.name) || {};
    if (!variable.type) {
      return typeof format === 'function' ? format?.(value, partialVar) : value;
    }
    // BMC Code Change Start
    let discardForAll = variable.discardForAll;
    if (getFeatureStatus('bhd-ar-all-values-v2') && discardForAll === undefined) {
      discardForAll = false;
    } else if (getFeatureStatus('bhd-ar-all-values') && discardForAll === undefined) {
      discardForAll = true;
    }
    if (
      emptyValue &&
      (variable.current.value?.[0] === ALL_VARIABLE_VALUE || variable.current.value === ALL_VARIABLE_VALUE) &&
      customAllValue === true &&
      variable.includeAll &&
      discardForAll
    ) {
      return emptyValue;
    }

    // For Scenes - treat generic "no selection" as the trigger for emptyValue.
    if (config.featureToggles.dashboardScene && emptyValue) {      
      const isEmptyArray = Array.isArray(value) && value.length === 0;
      const isEmptyString = value === '';
      const isNullish = value === null || value === undefined;
      if (isEmptyArray || isEmptyString || isNullish) {
        return emptyValue;
      }
    } else {
      // Legacy behavior: only treat explicit "None" selection as empty.
      if (
        value.length === 0 &&
        emptyValue &&
        (variable.current.text?.[0] === NONE_VARIABLE_TEXT || variable.current.text === NONE_VARIABLE_TEXT)
      ) {
        return emptyValue;
      }
    }

    return typeof format === 'function' ? format?.(value, partialVar) : value;
  }
  // BMC Code Change End

  replace(
    target?: string,
    scopedVars?: ScopedVars,
    format?: string | Function | undefined,
    interpolations?: VariableInterpolation[],
    emptyValue?: string,
    customAllValue?: boolean
  ): string {
    // Scenes compatability (primary method) is via SceneObject inside scopedVars. This way we get a much more accurate "local" scope for the evaluation
    if (scopedVars && scopedVars.__sceneObject) {
      // We are using valueOf here as __sceneObject can be after scenes 5.6.0 a SafeSerializableSceneObject that overrides valueOf to return the underlying SceneObject
      const sceneObject: SceneObject = scopedVars.__sceneObject.value.valueOf();
      return sceneGraph.interpolate(
        sceneObject,
        target,
        scopedVars,
        // BMC Change: Custom formmatter function
        ((value, variable) => {
          return this._formatVariableValueBMC(value, format, variable, undefined, emptyValue, customAllValue);
        }) as string | VariableCustomFormatterFn | undefined,
        interpolations
      );
    }

    // Scenes compatability: (secondary method) is using the current active scene as the scope for evaluation.
    if (window.__grafanaSceneContext && window.__grafanaSceneContext.isActive) {
      return sceneGraph.interpolate(
        window.__grafanaSceneContext,
        target,
        scopedVars,
        // BMC Change: Custom formmatter function
        ((value, variable) => {
          return this._formatVariableValueBMC(value, format, variable, undefined, emptyValue, customAllValue);
        }) as string | VariableCustomFormatterFn | undefined,
        interpolations
      );
    }

    if (!target) {
      return target ?? '';
    }

    this.regex.lastIndex = 0;
    // BMC Change Start
    const varMap: { [key: string]: number } = {};
    // BMC Change End

    return this._replaceWithVariableRegex(target, format, (match, variableName, fieldPath, fmt) => {
      // BMC Change Start
      const hasSingleQuote = containsSingleQuote(target, match, varMap);
      const emptyVal = emptyValue && hasSingleQuote ? emptyValue.substring(1, emptyValue.length - 1) : emptyValue;
      // BMC Change End
      const value = this._evaluateVariableExpression(
        match,
        variableName,
        fieldPath,
        fmt,
        scopedVars,
        emptyVal,
        customAllValue
      );

      // If we get passed this interpolations map we will also record all the expressions that were replaced
      if (interpolations) {
        interpolations.push({ match, variableName, fieldPath, format: fmt, value, found: value !== match });
      }

      return value;
    });
  }

  // BMC changes - update function definition, emptyValue parameter added
  private _evaluateVariableExpression(
    match: string,
    variableName: string,
    fieldPath: string,
    format: string | VariableCustomFormatterFn | undefined,
    scopedVars: ScopedVars | undefined,
    emptyValue?: string,
    customAllValue?: boolean
  ) {
    const variable = this.getVariableAtIndex(variableName);
    const scopedVar = scopedVars?.[variableName];

    if (scopedVar) {
      const value = this.getVariableValue(scopedVar, fieldPath);
      const text = this.getVariableText(scopedVar, value);

      if (value !== null && value !== undefined) {
        // BMC changes - add emptyValue as a parameter
        // DRJ71-8653: For scoped vars use the value as is, and no customAllValue applicable.
        return formatVariableValue(value, format, variable, text, emptyValue, false);
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

      // BMC changes - add emptyValue as a parameter
      return formatVariableValue(value, format, variable, text, emptyValue, customAllValue);
    }

    const systemValue = this.grafanaVariables.get(variable.current.value);
    if (systemValue) {
      // BMC changes - add emptyValue as a parameter
      return formatVariableValue(systemValue, format, variable, undefined, emptyValue, customAllValue);
    }

    let value = variable.current.value;
    let text = variable.current.text;

    if (this.isAllValue(value)) {
      value = this.getAllValue(variable);
      text = ALL_VARIABLE_TEXT;
      // skip formatting of custom all values unless format set to text or percentencode
      if (variable.allValue && format !== VariableFormatID.Text && format !== VariableFormatID.PercentEncode) {
        // BMC changes - add emptyValue as a parameter
        return this.replace(value, undefined, undefined, undefined, emptyValue, customAllValue);
      }
    }

    if (fieldPath) {
      const fieldValue = this.getVariableValue({ value, text }, fieldPath);
      if (fieldValue !== null && fieldValue !== undefined) {
        return formatVariableValue(fieldValue, format, variable, text, emptyValue, customAllValue);
      }
    }
    // BMC code
    if (variable.type === 'datepicker' && (format === 'from' || format === 'to')) {
      const dateTimeVal = dateRangeExtract(value);
      const timeRange = {
        from: dateTimeVal[0],
        to: dateTimeVal[1],
      };
      const isRelativeTime = rangeUtil.isRelativeTimeRange(timeRange);

      let convertedTimeRange;
      if (isRelativeTime) {
        const fiscalYearStartMonth = getState().dashboard?.getModel()?.fiscalYearStartMonth;
        convertedTimeRange = rangeUtil.convertRawToRange(
          {
            from: rangeUtil.isRelativeTime(dateTimeVal[0]) ? dateTimeVal[0] : dateTimeFormat(dateTimeVal[0]),
            to: rangeUtil.isRelativeTime(dateTimeVal[1]) ? dateTimeVal[1] : dateTimeFormat(dateTimeVal[1]),
          },
          getTimeSrv().timeModel?.getTimezone(),
          fiscalYearStartMonth
        );
      }

      switch (format) {
        case 'from':
          if (isRelativeTime) {
            return convertedTimeRange?.from.toISOString() ?? (customAllValue ? emptyValue! : match);
          }
          return dateTimeVal[0] && dateTimeVal[0] !== 'null' ? dateTimeVal[0] : customAllValue ? emptyValue! : match;
        case 'to':
          if (isRelativeTime) {
            return convertedTimeRange?.to.toISOString() ?? (customAllValue ? emptyValue! : match);
          }
          return dateTimeVal[1] && dateTimeVal[1] !== 'null' ? dateTimeVal[1] : customAllValue ? emptyValue! : match;
        default:
          return match;
      }
    }

    // End
    // BMC changes - add emptyValue as a parameter
    return formatVariableValue(value, format, variable, text, emptyValue, customAllValue);
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
      if (window.__grafanaSceneContext && window.__grafanaSceneContext.isActive) {
        return this.getVariables().find((v) => v.name === name);
      }
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
