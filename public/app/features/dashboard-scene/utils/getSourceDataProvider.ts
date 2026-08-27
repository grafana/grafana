import { type SceneDataProvider, SceneDataTransformer } from '@grafana/scenes';

/**
 * The provider holding untransformed results.
 */
export function getSourceDataProvider(dataProvider: SceneDataProvider): SceneDataProvider | undefined {
  return dataProvider instanceof SceneDataTransformer ? dataProvider.state.$data : dataProvider;
}
