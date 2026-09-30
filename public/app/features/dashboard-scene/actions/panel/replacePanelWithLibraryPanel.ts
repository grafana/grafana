import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';

import { type DashboardLayoutItem } from '../../scene/types/DashboardLayoutItem';
import { edit } from '../utils/edit';

interface ReplacePanelWithLibraryPanelProps {
  source: DashboardLayoutItem;
  oldPanel: VizPanel;
  newPanel: VizPanel;
}

export function replacePanelWithLibraryPanel({ source, oldPanel, newPanel }: ReplacePanelWithLibraryPanelProps) {
  newPanel.setState({ key: oldPanel.state.key });

  edit({
    description: t('dashboard.edit-actions.use-library-panel', 'Use library panel'),
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
