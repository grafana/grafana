import { SceneDataTransformer, type SceneDataTransformerState } from '@grafana/scenes';

import { PanelPluginTransformationsBehaviour } from '../scene/PanelPluginTransformationsBehaviour';

/**
 * Builds the data transformer that sits between a dashboard panel and its queries.
 *
 * Use this rather than `new SceneDataTransformer` for anything a `VizPanel` will render. Every panel
 * transformer has to carry `PanelPluginTransformationsBehaviour`, which is what runs the
 * transformations the panel's plugin registers, and a construction site that forgets it fails
 * silently: the panel renders untransformed data with no error and nothing in state to notice.
 *
 * `$behaviors` is deliberately not the caller's to set — that is what makes the guarantee
 * unconditional. A panel transformer that needs a second behaviour should gain it here.
 *
 * Lives apart from `createPanelDataProvider` to stay importable from `utils/utils.ts`, which that
 * module reaches back into through `DashboardDatasourceBehaviour`.
 */
export function createPanelDataTransformer(state: Omit<SceneDataTransformerState, '$behaviors'>): SceneDataTransformer {
  return new SceneDataTransformer({
    ...state,
    $behaviors: [new PanelPluginTransformationsBehaviour()],
  });
}
