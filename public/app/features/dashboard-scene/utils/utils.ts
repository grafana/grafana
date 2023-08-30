import { SceneDeactivationHandler, sceneGraph, SceneObject, VizPanel } from '@grafana/scenes';

export function getVizPanelKeyForPanelId(panelId: number) {
  return `panel-${panelId}`;
}

export function getPanelIdForVizPanel(panel: VizPanel): number {
  return parseInt(panel.state.key!.replace('panel-', ''), 10);
}

export function findVizPanelById(scene: SceneObject, id: string | undefined): VizPanel | null {
  if (!id) {
    return null;
  }

  const panelId = parseInt(id, 10);
  const key = getVizPanelKeyForPanelId(panelId);

  const obj = sceneGraph.findObject(scene, (obj) => obj.state.key === key);
  if (obj instanceof VizPanel) {
    return obj;
  }

  return null;
}

/**
 * Useful from tests to simulate mounting a full scene. Children are activated before parents to simulate the real order
 * of React mount order and useEffect ordering.
 *
 */
export function activateFullSceneTree(scene: SceneObject): SceneDeactivationHandler {
  const deactivationHandlers: SceneDeactivationHandler[] = [];

  scene.forEachChild((child) => {
    deactivationHandlers.push(activateFullSceneTree(child));
  });

  deactivationHandlers.push(scene.activate());

  return () => {
    for (const handler of deactivationHandlers) {
      handler();
    }
  };
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
