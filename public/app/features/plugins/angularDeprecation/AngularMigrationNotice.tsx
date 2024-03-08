import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, useStyles2 } from '@grafana/ui';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';

import { migrationFeatureFlags } from './utils';

const LOCAL_STORAGE_KEY_PREFIX = 'grafana.angularDeprecation.dashboardMigrationNotice.isDismissed';

function localStorageKey(dashboardUid: string): string {
  return LOCAL_STORAGE_KEY_PREFIX + '.' + dashboardUid;
}

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

export function AngularMigrationNotice({ dashboardUid }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <LocalStorageValueProvider<boolean> storageKey={localStorageKey(dashboardUid)} defaultValue={false}>
      {(isDismissed, onDismiss) => {
        if (isDismissed) {
          return null;
        }
        return (
          <div>
            <Alert
              severity="info"
              title="This dashboard was migrated from Angular. Please make sure everything is behaving as expected and save this dashboard to persist the migration."
              onRemove={() => onDismiss(true)}
            >
              <div className="markdown-html">
                <ul>
                  <li>
                    <a
                      href="https://github.com/grafana/grafana/issues/new?assignees=&labels=&projects=&template=0-bug-report.yaml&title=Product+Area%3A+Short+description+of+bug"
                      className="external-link"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Report issue.
                    </a>
                  </li>
                </ul>
                <Button fill="outline" size="sm" className={styles.linkButton} onClick={revertAutoMigrateUrlFlag}>
                  Revert migration
                </Button>
              </div>
            </Alert>
          </div>
        );
      }}
    </LocalStorageValueProvider>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  linkButton: css({
    marginRight: 10,
  }),
});
