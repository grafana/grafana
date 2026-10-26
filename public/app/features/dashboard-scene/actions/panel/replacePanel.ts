import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';

import { type DashboardLayoutItem } from '../../scene/types/DashboardLayoutItem';
import { edit } from '../utils/edit';

interface ReplacePanelProps {
  source: DashboardLayoutItem;
  oldPanel: VizPanel;
  newPanel: VizPanel;
}

export function replacePanel({ source, oldPanel, newPanel }: ReplacePanelProps) {
  newPanel.setState({ key: oldPanel.state.key });

  edit({
    meta: { actionId: 'panel.replace' },
    description: t('dashboard.edit-actions.replace-panel', 'Replace panel'),
    source,
    addedObject: newPanel,
    removedObject: oldPanel,
    perform() {
      source.setElementBody(newPanel);
    },
    undo() {
      source.setElementBody(oldPanel);
    },
  });
}
