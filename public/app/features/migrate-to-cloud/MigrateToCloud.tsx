import { config } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';

import { Page as CloudPage } from './cloud/Page';
import { Page as OnPremPage } from './onprem/Page';

export default function MigrateToCloud() {
  return <Page navId="migrate-to-cloud">{config.cloudMigrationIsTarget ? <CloudPage /> : <OnPremPage />}</Page>;
}
