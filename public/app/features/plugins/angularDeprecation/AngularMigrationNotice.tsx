import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { migrationFeatureFlags } from './utils';

interface Props {
  dashboardUid: string;
}

const revertAutoMigrateUrlFlag = () => {
  const url = new URL(window.location.toString());
  const urlParams = new URLSearchParams(url.search);

  urlParams.forEach((value, key) => {
    if (key.startsWith('__feature.')) {
      const featureName = key.substring(10);
      if (migrationFeatureFlags.has(featureName)) {
        urlParams.delete(key);
      }
    }
  });

  window.location.href = new URL(url.origin + url.pathname + '?' + urlParams.toString()).toString();
};

const reportIssue = () => {
  window.open(
    'https://github.com/grafana/grafana/issues/new?assignees=&labels=&projects=&template=0-bug-report.yaml&title=Product+Area%3A+Short+description+of+bug'
  );
};

export function AngularMigrationNotice({ dashboardUid }: Props) {
  const styles = useStyles2(getStyles);

  const [showAlert, setShowAlert] = useState(true);

  if (showAlert) {
    return (
      <Alert
        severity="info"
        title="This dashboard was migrated from Angular. Please make sure everything is behaving as expected and save and refresh this dashboard to persist the migration."
        onRemove={() => setShowAlert(false)}
      >
        <div className="markdown-html">
          <Button fill="outline" size="sm" className={styles.linkButton} onClick={reportIssue}>
            <Trans i18nKey="plugins.angular-migration-notice.report-issue">Report issue</Trans>
          </Button>
          <Button fill="outline" size="sm" className={styles.linkButton} onClick={revertAutoMigrateUrlFlag}>
            <Trans i18nKey="plugins.angular-migration-notice.revert-migration">Revert migration</Trans>
          </Button>
        </div>
      </Alert>
    );
  }

  return null;
}

const getStyles = (theme: GrafanaTheme2) => ({
  linkButton: css({
    marginRight: 10,
  }),
});
