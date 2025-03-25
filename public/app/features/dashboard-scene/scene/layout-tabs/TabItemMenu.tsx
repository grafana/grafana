import { Button } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { TabItem } from './TabItem';

interface Props {
  model: TabItem;
}

export function TabItemMenu({ model }: Props) {
  return (
    <div className="dashboard-canvas-add-button">
      <Button
        aria-label={t('dashboard.tabs-layout.tab.menu.add', 'Add tab')}
        title={t('dashboard.tabs-layout.tab.menu.add', 'Add tab')}
        tooltip={t('dashboard.tabs-layout.tab.menu.add', 'Add tab')}
        icon="plus"
        variant="primary"
        fill="text"
        onClick={() => model.onAddTab()}
      >
        New tab
      </Button>
    </div>
  );
}
