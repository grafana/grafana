import { chain } from 'lodash';

import { getDataSourceRef } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { getDataSourceInstanceList, getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import {
  ConstantVariable,
  CustomVariable,
  DataSourceVariable,
  IntervalVariable,
  TextBoxVariable,
  QueryVariable,
  GroupByVariable,
  type SceneVariable,
  type MultiValueVariable,
  sceneUtils,
  type SceneObject,
  AdHocFiltersVariable,
  type SceneVariableState,
  SceneVariableSet,
  SwitchVariable,
} from '@grafana/scenes';
import { type DataSourceRef, VariableHide, type VariableType } from '@grafana/schema';

import { isPredefinedOrigin } from '../../utils/predefinedVariables';
import { getIntervalsQueryFromNewIntervalModel } from '../../utils/utils';

// NOTE: type names/descriptions live in `editableVariablesMetadata.ts` and the editor
// component registry lives in `editableVariablesRegistry.ts`. Keep editor imports out
// of this file: it is reached from view-mode code (variable controls, change tracking)
// and any editor import here would pull all variable editors into the initial bundle.

//exclude system variable type and snapshot variable type
export type EditableVariableType = Exclude<VariableType, 'system' | 'snapshot'>;

export function isEditableVariableType(type: VariableType): type is EditableVariableType {
  return type !== 'system' && type !== 'snapshot';
}

export const getDefaultTopPlacementLabel = () => t('dashboard.sidebar.variables.top-placement', 'Above dashboard');

export interface CommonVariableProperties {
  name: string;
  label?: string;
  key?: string;
}

async function getDefaultDatasourceRef(): Promise<DataSourceRef | undefined> {
  const defaultDs = await getDataSourceInstanceSettings(null);
  return defaultDs ? getDataSourceRef(defaultDs) : undefined;
}

export async function getVariableScene(type: EditableVariableType, initialState: CommonVariableProperties) {
  switch (type) {
    case 'custom':
      return new CustomVariable(initialState);
    case 'query': {
      // we need to initialize the query variable with the default datasource
      // this matches the behavior in Settings -> Variables -> Add Variable
      // otherwise v2 transformer to save model will treat the variable as auto-assigned and
      // not include it in the save model
      const datasource = await getDefaultDatasourceRef();
      return new QueryVariable({ ...initialState, ...(datasource && { datasource }) });
    }
    case 'constant':
      return new ConstantVariable({ ...initialState, hide: VariableHide.hideVariable });
    case 'interval':
      return new IntervalVariable(initialState);
    case 'datasource':
      return new DataSourceVariable(initialState);
    case 'adhoc':
      return new AdHocFiltersVariable({
        ...initialState,
        ...(config.featureToggles.dashboardUnifiedDrilldownControls ? { enableGroupBy: true } : {}),
      });
    case 'groupby':
      return new GroupByVariable(initialState);
    case 'textbox':
      return new TextBoxVariable(initialState);
    case 'switch':
      return new SwitchVariable(initialState);
  }
}

export async function getVariableDefault(variables: Array<SceneVariable<SceneVariableState>>) {
  const nextVariableIdName = getNextAvailableId('query', variables);
  return getVariableScene('query', { name: nextVariableIdName });
}

export function getVariableNamePrefix(type: EditableVariableType): string {
  return type === 'adhoc' ? 'filter' : type;
}

export function getNextAvailableId(
  type: VariableType | string,
  variables: Array<SceneVariable<SceneVariableState>>
): string {
  let counter = 0;
  let nextId = `${type}${counter}`;

  while (variables.find((variable) => variable.state.name === nextId)) {
    nextId = `${type}${++counter}`;
  }

  return nextId;
}

export function hasVariableOptions(variable: SceneVariable): variable is MultiValueVariable {
  // variable options can be defined by state.options or state.intervals in case of interval variable
  return 'options' in variable.state || 'intervals' in variable.state;
}

export function getDefinition(model: SceneVariable): string {
  let definition = '';

  if (model instanceof QueryVariable) {
    definition = model.state.definition || (typeof model.state.query === 'string' ? model.state.query : '');
  } else if (model instanceof DataSourceVariable) {
    definition = String(model.state.pluginId);
  } else if (model instanceof CustomVariable) {
    definition = model.state.query;
  } else if (model instanceof IntervalVariable) {
    definition = getIntervalsQueryFromNewIntervalModel(model.state.intervals);
  } else if (model instanceof TextBoxVariable || model instanceof ConstantVariable) {
    definition = String(model.state.value);
  }

  return definition;
}

export async function getOptionDataSourceTypes() {
  const datasources = await getDataSourceInstanceList({ metrics: true, variables: true });

  const optionTypes = chain(datasources)
    .uniqBy('meta.id')
    .map((ds) => {
      return { label: ds.meta.name, value: ds.meta.id };
    })
    .value();

  return optionTypes;
}

export function isSceneVariable(sceneObject: SceneObject): sceneObject is SceneVariable {
  return 'type' in sceneObject.state && 'getValue' in sceneObject;
}

export function isSceneVariableInstance(sceneObject: SceneObject): sceneObject is SceneVariable {
  if (!isSceneVariable(sceneObject)) {
    return false;
  }

  return (
    sceneUtils.isAdHocVariable(sceneObject) ||
    sceneUtils.isConstantVariable(sceneObject) ||
    sceneUtils.isCustomVariable(sceneObject) ||
    sceneUtils.isDataSourceVariable(sceneObject) ||
    sceneUtils.isIntervalVariable(sceneObject) ||
    sceneUtils.isQueryVariable(sceneObject) ||
    sceneUtils.isTextBoxVariable(sceneObject) ||
    sceneUtils.isGroupByVariable(sceneObject) ||
    sceneUtils.isSwitchVariable(sceneObject)
  );
}

export const RESERVED_GLOBAL_VARIABLE_NAME_REGEX = /^(?!__).*$/;
export const WORD_CHARACTERS_REGEX = /^\w+$/;

export interface VariableNameValidationResult {
  isValid: boolean;
  errorMessage?: string;
  warningMessage?: string;
}

export const getPredefinedVariableShadowWarning = () =>
  t(
    'dashboard-scene.validate-variable-name.warning-predefined-shadow',
    'A global or folder variable with this name exists and will be overwritten by this dashboard variable.'
  );

/**
 * Predefined variables dropped for live shadowing are kept here so they can be
 * re-injected when the shadowing local is renamed away or deleted.
 *
 * Keyed by the variable set's parent (dashboard / row / tab) — not the set itself —
 * because mutation commands replace the SceneVariableSet instance while keeping the
 * same owner. Falls back to the set when it has no parent (unit tests).
 */
const shadowedPredefinedByOwner = new WeakMap<object, Map<string, SceneVariable>>();

function getShadowStash(set: SceneVariableSet, ownerHint?: object): Map<string, SceneVariable> {
  // Prefer the live parent (dashboard / row / tab). Fall back to an explicit owner for
  // mutation mocks / replace flows where the set may not be parented yet.
  const owner: object = set.parent ?? ownerHint ?? set;
  let byName = shadowedPredefinedByOwner.get(owner);
  if (!byName) {
    byName = new Map();
    shadowedPredefinedByOwner.set(owner, byName);
  }
  return byName;
}

function stashPredefinedVariable(set: SceneVariableSet, variable: SceneVariable, ownerHint?: object): void {
  getShadowStash(set, ownerHint).set(variable.state.name, variable);
}

/**
 * Removes a predefined (global/folder) variable of the given name from the set so a
 * dashboard/section-local variable can take over at runtime (nearest scope wins).
 * Stashes the dropped variable for later restore when nothing local shadows it.
 *
 * `ownerHint` is used when `set.parent` is unset (e.g. mutation commands that replace
 * the variable set on a mock / unparented owner).
 */
export function dropPredefinedVariableNamed(set: SceneVariableSet, name: string, ownerHint?: object): void {
  const toDrop = set.state.variables.filter((v) => v.state.name === name && isPredefinedOrigin(v.state.origin));
  if (toDrop.length === 0) {
    return;
  }

  for (const variable of toDrop) {
    stashPredefinedVariable(set, variable, ownerHint);
  }

  set.setState({
    variables: set.state.variables.filter((v) => !(v.state.name === name && isPredefinedOrigin(v.state.origin))),
  });
}

/**
 * Re-injects a stashed predefined variable named `name` into `set` when nothing in
 * that set currently uses the name.
 */
function restorePredefinedVariableNamed(set: SceneVariableSet, name: string, ownerHint?: object): void {
  if (set.state.variables.some((v) => v.state.name === name)) {
    return;
  }

  const stashed = getShadowStash(set, ownerHint).get(name);
  if (!stashed) {
    return;
  }

  set.setState({ variables: [stashed, ...set.state.variables] });
}

export type VariableSetSnapshot = { set: SceneVariableSet; variables: SceneVariable[] };

function forEachVariableSetAlongPath(from: SceneVariable | SceneVariableSet, visit: (set: SceneVariableSet) => void) {
  const set = from instanceof SceneVariableSet ? from : from.parent;
  if (!(set instanceof SceneVariableSet)) {
    return;
  }

  visit(set);

  let ancestor: SceneObject | undefined = set.parent;
  while (ancestor) {
    const ancestorVars = ancestor.state.$variables;
    if (ancestorVars instanceof SceneVariableSet && ancestorVars !== set) {
      visit(ancestorVars);
    }
    ancestor = ancestor.parent;
  }
}

/**
 * Snapshots this variable's set and ancestor sets. Used so rename/drop side effects
 * (including predefined restore) can be undone by restoring the prior arrays.
 */
export function snapshotVariableSetsAlongPath(variable: SceneVariable): VariableSetSnapshot[] {
  const snapshots: VariableSetSnapshot[] = [];
  forEachVariableSetAlongPath(variable, (set) => {
    snapshots.push({ set, variables: [...set.state.variables] });
  });
  return snapshots;
}

/**
 * Snapshots variable sets that currently hold a predefined variable named `name`
 * (this variable's set and ancestors). Used so a later drop can be undone.
 */
export function snapshotSetsWithPredefinedNamed(variable: SceneVariable, name: string): VariableSetSnapshot[] {
  const snapshots: VariableSetSnapshot[] = [];
  forEachVariableSetAlongPath(variable, (candidate) => {
    if (candidate.state.variables.some((v) => v.state.name === name && isPredefinedOrigin(v.state.origin))) {
      snapshots.push({ set: candidate, variables: [...candidate.state.variables] });
    }
  });
  return snapshots;
}

export function restoreVariableSetSnapshots(snapshots: VariableSetSnapshot[]): void {
  for (const { set, variables } of snapshots) {
    set.setState({ variables });
  }
}

/**
 * Drops any predefined variable shadowed by `name` from this variable's set and
 * ancestor sets. Safe when the collision is a non-predefined dashboard local —
 * those are left in place (section shadowing does not delete them).
 *
 * Call only on name *commit* (blur / undoable edit action), never on each keystroke —
 * intermediate typed names that briefly match a predefined variable must not drop it.
 */
export function dropShadowedPredefinedVariables(variable: SceneVariable, name: string): void {
  forEachVariableSetAlongPath(variable, (set) => dropPredefinedVariableNamed(set, name));
}

/**
 * Re-injects stashed predefined variables that are no longer shadowed by a local
 * variable in this set or ancestor sets. Call after rename-away or delete of a local.
 *
 * `ownerHint` is forwarded when sets may be unparented (mutation replace flows).
 */
export function restoreUnshadowedPredefinedVariables(from: SceneVariable | SceneVariableSet, ownerHint?: object): void {
  forEachVariableSetAlongPath(from, (set) => {
    const stashed = getShadowStash(set, ownerHint);
    for (const name of stashed.keys()) {
      restorePredefinedVariableNamed(set, name, ownerHint);
    }
  });
}

export function validateVariableName(variable: SceneVariable, name: string): VariableNameValidationResult {
  const set = variable.parent;
  if (!(set instanceof SceneVariableSet)) {
    throw new Error('Variable parent is not a SceneVariableSet');
  }

  if (!RESERVED_GLOBAL_VARIABLE_NAME_REGEX.test(name)) {
    return {
      isValid: false,
      errorMessage: "Template names cannot begin with '__', that's reserved for Grafana's global variables",
    };
  }

  if (!WORD_CHARACTERS_REGEX.test(name)) {
    return { isValid: false, errorMessage: 'Only word characters are allowed in variable names' };
  }

  const varLookupByName = set.getByName(name);

  if (varLookupByName && varLookupByName !== variable) {
    if (isPredefinedOrigin(varLookupByName.state.origin)) {
      return {
        isValid: true,
        warningMessage: getPredefinedVariableShadowWarning(),
      };
    }
    return { isValid: false, errorMessage: 'Variable with the same name already exists' };
  }

  // Check ancestor variable sets — section variable shadows a dashboard-level variable
  let ancestor: SceneObject | undefined = set.parent;
  while (ancestor) {
    const ancestorVars = ancestor.state.$variables;
    if (ancestorVars instanceof SceneVariableSet && ancestorVars !== set) {
      const ancestorVar = ancestorVars.getByName(name);
      if (ancestorVar) {
        return {
          isValid: true,
          warningMessage: isPredefinedOrigin(ancestorVar.state.origin)
            ? getPredefinedVariableShadowWarning()
            : 'A variable with this name already exists at the dashboard level. This variable will overwrite it.',
        };
      }
    }
    ancestor = ancestor.parent;
  }

  // Check descendant variable sets — dashboard variable collides with a section variable
  if (set.parent) {
    const conflict = findNameInDescendantSets(set.parent, name, set);
    if (conflict) {
      return {
        isValid: true,
        warningMessage:
          'A variable with this name already exists in a section. This variable will be ignored in that section.',
      };
    }
  }

  return { isValid: true };
}

function findNameInDescendantSets(sceneObject: SceneObject, name: string, excludeSet: SceneVariableSet): boolean {
  let found = false;
  sceneObject.forEachChild((child) => {
    if (found) {
      return;
    }
    const childVars = child.state.$variables;
    if (childVars instanceof SceneVariableSet && childVars !== excludeSet && childVars.getByName(name)) {
      found = true;
      return;
    }
    if (findNameInDescendantSets(child, name, excludeSet)) {
      found = true;
    }
  });
  return found;
}

export function isVariableEditable(variable: SceneVariable) {
  return isEditableVariableType(variable.state.type) && variable.state.origin === undefined;
}
