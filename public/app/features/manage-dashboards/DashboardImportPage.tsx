import { Page } from 'app/core/components/Page/Page';

import { TemplateList } from './templates-catalog/TemplateList';

function DashboardImportPage() {
  const navModelItem = { text: 'Import dashboard', subTitle: 'Import dashboard from file or Grafana.com' };

  return (
    <Page navId="dashboards/browse" pageNav={navModelItem}>
      <Page.Contents>
        <TemplateList />
      </Page.Contents>
    </Page>
  );
}

export default DashboardImportPage;
