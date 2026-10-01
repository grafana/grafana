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
 */
export function buildPanelElementFromPlugin(panel: Panel): PanelElement {
  const source = cloneDeep(panel);
  const model = new PanelModel({
    ...source,
    id: TRANSIENT_PANEL_ID,
    title: source.title || t('notebooks.add-to-notebook-form.title.new-panel', 'New panel'),
    type: source.type || 'timeseries',
    // An omitted query list must stay empty. PanelModel otherwise seeds a blank query.
    targets: source.targets ?? [],
    options: source.options ?? {},
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
