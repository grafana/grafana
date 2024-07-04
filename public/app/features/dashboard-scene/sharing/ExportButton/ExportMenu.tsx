import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Menu } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { DashboardScene } from '../../scene/DashboardScene';
import { ShareDrawer } from '../ShareDrawer/ShareDrawer';

import { ExportAsJson } from './ExportAsJson';

const newExportButtonSelector = e2eSelectors.pages.Dashboard.DashNav.NewExportButton.Menu;

export default function ExportMenu({ dashboard }: { dashboard: DashboardScene }) {
  const onExportAsJsonClick = () => {
    const drawer = new ShareDrawer({
      title: t('export.json.title', 'Save dashboard JSON'),
      body: new ExportAsJson({}),
    });

    dashboard.showModal(drawer);
  };

  return (
    <Menu data-testid={newExportButtonSelector.container}>
      <Menu.Item
        testId={newExportButtonSelector.exportAsJson}
        label={t('share-dashboard.menu.export-json-title', 'Export as JSON')}
        icon="arrow"
        onClick={onExportAsJsonClick}
      />
    </Menu>
  );
}
