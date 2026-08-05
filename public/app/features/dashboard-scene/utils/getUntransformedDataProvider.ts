import { type SceneDataProvider, SceneDataTransformer } from '@grafana/scenes';

/**
 * Returns the provider that produced the raw query result, skipping every transformer wrapping it.
 *
 * A panel's data can be wrapped by more than one transformer — the user's, and the panel plugin's
 * (see `PanelPluginDataTransformer`) — so unwrapping `state.$data` a single level no longer
 * reaches the query runner. Use this wherever the intent is "before transformations", for example
 * snapshots, the panel inspector's raw data view, or finding the query runner behind a panel.
 *
 * Lives in its own module rather than in `./utils` because that module imports the panel header
 * scene objects, which need this function — the same import cycle that made `getVizSuggestionForQuery`
 * and `DownloadDiagnostics` inline their own copies of `getQueryRunnerFor`.
 */
export function getUntransformedDataProvider(dataProvider: SceneDataProvider): SceneDataProvider;
/** Overload for callers that may not have a provider yet, so they keep having to handle that. */
export function getUntransformedDataProvider(
  dataProvider: SceneDataProvider | undefined
): SceneDataProvider | undefined;
export function getUntransformedDataProvider(
  dataProvider: SceneDataProvider | undefined
): SceneDataProvider | undefined {
  let current = dataProvider;

  while (current instanceof SceneDataTransformer && current.state.$data) {
    current = current.state.$data;
  }

  return current;
}
