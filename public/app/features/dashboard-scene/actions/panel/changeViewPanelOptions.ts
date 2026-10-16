import { isEqual } from 'lodash';

import { type FieldConfigSource } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';

import { getDashboardSceneFor } from '../../utils/utils';
import { edit } from '../utils/edit';

export function changeViewPanelOptions(panel: VizPanel, options: Record<string, unknown>) {
  const oldOptions = panel.state.options;
  const perform = () => panel.onOptionsChange(options);

  if (!getDashboardSceneFor(panel).state.isEditing || isEqual(oldOptions, options)) {
    perform();
    return;
  }

  edit({
    source: panel,
    meta: { actionId: 'panel.changeViewOptions' },
    description: t('dashboard.edit-actions.view-panel-options', 'Change panel quick toggle'),
    perform,
    undo: () => panel.onOptionsChange(oldOptions, true),
  });
}

export function changeViewPanelFieldConfig(panel: VizPanel, fieldConfig: FieldConfigSource) {
  const oldFieldConfig = panel.state.fieldConfig;
  const perform = () => panel.onFieldConfigChange(fieldConfig, true);

  if (!getDashboardSceneFor(panel).state.isEditing || isEqual(oldFieldConfig, fieldConfig)) {
    perform();
    return;
  }

  edit({
    source: panel,
    meta: { actionId: 'panel.changeViewFieldConfig' },
    description: t('dashboard.edit-actions.view-panel-options', 'Change panel quick toggle'),
    perform,
    undo: () => panel.onFieldConfigChange(oldFieldConfig, true),
  });
}
