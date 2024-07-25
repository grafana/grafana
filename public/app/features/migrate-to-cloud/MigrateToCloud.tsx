import { config } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { Page as CloudPage } from './cloud/Page';
import { Page as OnPremPage } from './onprem/Page';

export default function MigrateToCloud() {
  const feedbackURL = config.cloudMigrationFeedbackURL;
  return (
    <Page navId="migrate-to-cloud">
      <Alert
        title={'Migrate to Grafana Cloud is in public preview'}
        severity={'info'}
        onRemove={
          feedbackURL
            ? () => {
                window.location.href = feedbackURL;
              }
            : undefined
        }
        buttonContent={'Give feedback'}
      >
        Help us to improve Grafana Cloud by providing feedback and reporting issues.
      </Alert>
      {config.cloudMigrationIsTarget ? <CloudPage /> : <OnPremPage />}
    </Page>
  );
}
