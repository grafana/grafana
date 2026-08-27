import { type SceneDataProvider, SceneDataTransformer } from '@grafana/scenes';

/**
 * The provider holding untransformed results. A `SceneDataTransformer` keeps its own output in
 * `state.data`, which makes it the one provider that cannot be read directly; it carries its source
 * in `$data`.
 *
 * Returns undefined for a transformer with no source, leaving the choice between "raw or nothing"
 * and "raw, else whatever ran" to the caller — snapshots need the former, display the latter.
 *
 * Kept in its own module (rather than in the larger `utils/utils.ts` hub) so the serializers can
 * read source data without importing that hub, which would close an import cycle back through it.
 */
export function getSourceDataProvider(dataProvider: SceneDataProvider): SceneDataProvider | undefined {
  return dataProvider instanceof SceneDataTransformer ? dataProvider.state.$data : dataProvider;
}
