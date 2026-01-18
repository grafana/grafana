import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Dropdown, Sidebar } from '@grafana/ui';

import { DashboardScene } from '../scene/DashboardScene';
import ExportMenu from '../sharing/ExportButton/ExportMenu';

interface Props {
  dashboard: DashboardScene;
}

const newExportButtonSelector = selectors.pages.Dashboard.DashNav.NewExportButton;

export function ShareExportDashboardButton({ dashboard }: Props) {
  return (
    <Dropdown overlay={<ExportMenu dashboard={dashboard} />} placement="left-start">
      <Sidebar.Button
        icon="download-alt"
        data-testid={newExportButtonSelector.Menu.container}
        title={t('dashboard.sidebar.export.title', 'Export')}
      />
    </Dropdown>
  );
}
