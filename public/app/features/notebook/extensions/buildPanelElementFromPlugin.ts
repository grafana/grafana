import { cloneDeep } from 'lodash';

import { t } from '@grafana/i18n';
import { VizPanel } from '@grafana/scenes';
import { type Panel } from '@grafana/schema';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { vizPanelToSchemaV2 } from 'app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2';
import { createPanelDataProvider } from 'app/features/dashboard-scene/utils/createPanelDataProvider';
import { getVizPanelKeyForPanelId } from 'app/features/dashboard-scene/utils/utils-panels';

import { type PanelElement } from '../types';

/**
 * The id only has to be free within this throwaway panel — appendPanelToNotebook mints the one the
 * notebook actually stores. Same as the Explore builder.
 */
const TRANSIENT_PANEL_ID = 1;

/**
 * Turns the `Panel` a plugin built for the add-to-notebook form into the element a notebook stores.
 *
 * The same panel model grafana/add-to-dashboard-form/v1 accepts, so a plugin does not learn a second
 * shape. Assembled the same way as Explore's builder: a PanelModel, then a VizPanel with no menus or
 * header actions, because vizPanelToSchemaV2 reads neither and both only make sense inside a
 * dashboard. The panel is cloned first because PanelModel writes refIds onto queries that lack
 * them, and that write would land on the plugin's own objects.
 *
 * Queries should already be interpolated. A notebook has no dashboard variables, so a `$service`
 * left in a query resolves to nothing there.
 */
export function buildPanelElementFromPlugin(panel: Panel): PanelElement {
  const model = new PanelModel({
    id: TRANSIENT_PANEL_ID,
    title: panel.title || t('notebooks.add-to-notebook-form.title.new-panel', 'New panel'),
    type: panel.type || 'timeseries',
    targets: cloneDeep(panel.targets ?? []),
    datasource: cloneDeep(panel.datasource),
    options: cloneDeep(panel.options) ?? {},
    fieldConfig: cloneDeep(panel.fieldConfig),
    transformations: cloneDeep(panel.transformations),
  });

  const vizPanel = new VizPanel({
    key: getVizPanelKeyForPanelId(model.id),
    title: model.title,
    pluginId: model.type,
    options: model.options ?? {},
    fieldConfig: model.fieldConfig,
    $data: createPanelDataProvider(model),
  });

  // Both optional args stay omitted: a dsReferencesMapping would send vizPanelToSchemaV2 looking for
  // an enclosing DashboardScene, and this panel has no scene at all.
  return vizPanelToSchemaV2(vizPanel);
}
