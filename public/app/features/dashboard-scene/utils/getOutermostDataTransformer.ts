import { SceneDataTransformer, type SceneObject } from '@grafana/scenes';

/**
 * Walks up from a query runner to the outermost transformer wrapping it — the one holding the
 * user's transformations. Panel plugins can contribute their own transformer below it
 * (see `PanelPluginDataTransformer`), so the immediate parent is not necessarily the
 * user's transformer.
 *
 * Lives beside `getUntransformedDataProvider` — see that module for why these chain accessors
 * cannot live in `./utils`.
 *
 * TODO: Move into @grafana/scenes as a shared helper method — the provider-chain shape is
 * defined by scenes, so every scenes consumer needs the same walk.
 */
export function getOutermostDataTransformer(sceneObject: SceneObject): SceneDataTransformer | undefined {
  let outermost: SceneDataTransformer | undefined;
  let current: SceneObject | undefined = sceneObject.parent;

  while (current instanceof SceneDataTransformer) {
    outermost = current;
    current = current.parent;
  }

  return outermost;
}
