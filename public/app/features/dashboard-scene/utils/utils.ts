import { UrlQueryMap, urlUtil } from '@grafana/data';
import { locationSearchToObject } from '@grafana/runtime';
import { MultiValueVariable, sceneGraph, SceneObject, VizPanel } from '@grafana/scenes';

export function getVizPanelKeyForPanelId(panelId: number) {
  return `panel-${panelId}`;
}

export function getPanelIdForVizPanel(panel: SceneObject): number {
  return parseInt(panel.state.key!.replace('panel-', ''), 10);
}

/**
 * This will also  try lookup based on panelId
 */
export function findVizPanelByKey(scene: SceneObject, key: string | undefined): VizPanel | null {
  if (!key) {
    return null;
  }

  const panel = findVizPanelInternal(scene, key);
  if (panel) {
    return panel;
  }

  // Also try to find by panel id
  const id = parseInt(key, 10);
  if (isNaN(id)) {
    return null;
  }

  return findVizPanelInternal(scene, getVizPanelKeyForPanelId(id));
}

function findVizPanelInternal(scene: SceneObject, key: string | undefined): VizPanel | null {
  if (!key) {
    return null;
  }

  const panel = sceneGraph.findObject(scene, (obj) => obj.state.key === key);
  if (panel) {
    if (panel instanceof VizPanel) {
      return panel;
    } else {
      throw new Error(`Found panel with key ${key} but it was not a VizPanel`);
    }
  }

  return null;
}

/**
 * Force re-render children. This is useful in some edge case scenarios when
 * children deep down the scene graph needs to be re-rendered when some parent state change.
 *
 * Example could be isEditing bool flag or a layout IsDraggable state flag.
 *
 * @param model The model whose children should be re-rendered. It does not force render this model, only the children.
 * @param recursive if it should keep force rendering down to leaf nodess
 */
export function forceRenderChildren(model: SceneObject, recursive?: boolean) {
  model.forEachChild((child) => {
    if (!child.isActive) {
      return;
    }

    child.forceRender();
    forceRenderChildren(child, recursive);
  });
}

export interface DashboardUrlOptions {
  uid?: string;
  subPath?: string;
  updateQuery?: UrlQueryMap;
  /**
   * Set to location.search to preserve current params
   */
  currentQueryParams: string;
}

export function getDashboardUrl(options: DashboardUrlOptions) {
  const url = `/scenes/dashboard/${options.uid}${options.subPath ?? ''}`;

  const params = options.currentQueryParams ? locationSearchToObject(options.currentQueryParams) : {};

  if (options.updateQuery) {
    for (const key of Object.keys(options.updateQuery)) {
      // removing params with null | undefined
      if (options.updateQuery[key] === null || options.updateQuery[key] === undefined) {
        delete params[key];
      } else {
        params[key] = options.updateQuery[key];
      }
    }
  }

  return urlUtil.renderUrl(url, params);
}

export function getMultiVariableValues(variable: MultiValueVariable) {
  const { value, text, options } = variable.state;

  if (variable.hasAllValue()) {
    return {
      values: options.map((o) => o.value),
      texts: options.map((o) => o.label),
    };
  }

  return {
    values: Array.isArray(value) ? value : [value],
    texts: Array.isArray(text) ? text : [text],
  };
}
