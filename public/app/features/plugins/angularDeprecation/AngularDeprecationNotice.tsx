import { reportInteraction } from '@grafana/runtime';
import { Alert, Button } from '@grafana/ui';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';
import { Trans } from 'app/core/internationalization';

const LOCAL_STORAGE_KEY_PREFIX = 'grafana.angularDeprecation.dashboardNoticeAndMigration.isDismissed';

function localStorageKey(dashboardUid: string): string {
  return LOCAL_STORAGE_KEY_PREFIX + '.' + dashboardUid;
}

export interface Props {
  dashboardUid: string;
  showAutoMigrateLink?: boolean;
}

function tryMigration() {
  const autoMigrateParam = '__feature.autoMigrateOldPanels';
  const url = new URL(window.location.toString());
  if (!url.searchParams.has(autoMigrateParam)) {
    url.searchParams.append(autoMigrateParam, 'true');
  }
  window.open(url.toString(), '_self');
}

export function AngularDeprecationNotice({ dashboardUid, showAutoMigrateLink }: Props) {
  return (
    <LocalStorageValueProvider<boolean> storageKey={localStorageKey(dashboardUid)} defaultValue={false}>
      {(isDismissed, onDismiss) => {
        if (isDismissed) {
          return null;
        }
        return (
          <div>
            <Alert
              severity="warning"
              title="This dashboard depends on Angular, which is deprecated and will stop working in future releases of Grafana."
              onRemove={() => {
                reportInteraction('angular_deprecation_notice_dismissed');
                onDismiss(true);
              }}
            >
              <div className="markdown-html">
                <a
                  href="https://grafana.com/docs/grafana/latest/developers/angular_deprecation/"
                  className="external-link"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Trans i18nKey="plugins.angular-deprecation-notice.deprecation-notice-migration-advice">
                    Read our deprecation notice and migration advice.
                  </Trans>
                </a>
                <br />

                {showAutoMigrateLink && (
                  <Button fill="outline" size="sm" onClick={tryMigration} style={{ marginTop: 10 }}>
                    <Trans i18nKey="plugins.angular-deprecation-notice.try-migration">Try migration</Trans>
                  </Button>
                )}
              </div>
            </Alert>
          </div>
        );
      }}
    </LocalStorageValueProvider>
  );
}
