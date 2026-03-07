import { SceneObject, VizPanel } from '@grafana/scenes';

interface RepeatableParentState {
  variableName?: string;
  repeatDirection?: 'v' | 'h';
  repeatedPanels?: VizPanel[];
}

export interface PanelRepeatInfo {
  isRepeated: boolean;
  variableName?: string;
}

/**
 * Applies migration to an already-interpolated variable result for repeated panels.
 *
 * Repeated panels receive a single string value from a multi-select variable.
 * SqlDatasource.interpolateVariable wraps such values with quoteLiteral
 * (e.g. 'value'). If the raw SQL already has quotes around the variable reference
 * (e.g. WHERE x = '$var'), this produces double-quoting: WHERE x = ''value''.
 *
 * This function detects that scenario and strips the redundant outer quotes.
 */
export function migrateInterpolation(
  interpolatedResult: string | number,
  variableName: string,
  rawSql?: string,
  sceneObj?: SceneObject
): string | number {
  if (typeof interpolatedResult === 'string' && rawSql && sceneObj) {
    const repeatInfo = getRepeatInfo(sceneObj);
    if (repeatInfo?.variableName && isVariableQuotedInQuery(variableName, rawSql)) {
      return stripOuterQuotes(interpolatedResult);
    }
  }

  return interpolatedResult;
}

/**
 * Checks whether a variable reference is wrapped in single quotes in the raw SQL.
 * Matches patterns like '$varName' and '${varName}'.
 */
export function isVariableQuotedInQuery(variableName: string, rawSql: string): boolean {
  const escaped = variableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`'\\$\\{?${escaped}\\}?'`);
  return pattern.test(rawSql);
}

/**
 * Strips the outermost pair of single quotes from a string value.
 * E.g. "'value'" → "value", "'O''Brien'" → "O''Brien".
 */
export function stripOuterQuotes(value: string): string {
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Extracts repeat information from the scene object hierarchy.
 * Returns undefined if no VizPanel is found in the parent chain.
 */
export function getRepeatInfo(sceneObj?: SceneObject): PanelRepeatInfo | undefined {
  if (!sceneObj) {
    return undefined;
  }

  const vizPanel = getVizPanelFromScene(sceneObj);
  if (!vizPanel) {
    return undefined;
  }

  return getPanelRepeatInfo(vizPanel);
}

function getVizPanelFromScene(scene: SceneObject): VizPanel | undefined {
  let current: SceneObject | undefined = scene;
  let depth = 0;

  while (current && depth < 20) {
    if (isVizPanel(current)) {
      return current;
    }
    current = current.parent;
    depth++;
  }

  return undefined;
}

function isVizPanel(obj: SceneObject): obj is VizPanel {
  return obj.constructor.name === 'VizPanel';
}

function getPanelRepeatInfo(vizPanel: VizPanel): PanelRepeatInfo {
  const panelState = vizPanel.state;
  const parent = vizPanel.parent;
  const parentState = getRepeatableParentState(parent);

  return {
    isRepeated: Boolean(panelState.repeatSourceKey),
    variableName: parentState?.variableName,
  };
}

function getRepeatableParentState(parent: SceneObject | undefined): RepeatableParentState | undefined {
  if (!parent || !('state' in parent)) {
    return undefined;
  }

  const state = parent.state;
  if (isRepeatableParentState(state)) {
    return state;
  }

  return undefined;
}

function isRepeatableParentState(state: unknown): state is RepeatableParentState {
  return (
    typeof state === 'object' &&
    state !== null &&
    ('variableName' in state || 'repeatDirection' in state || 'repeatedPanels' in state)
  );
}
