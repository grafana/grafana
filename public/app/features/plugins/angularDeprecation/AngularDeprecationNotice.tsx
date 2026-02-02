import { reportInteraction } from '@grafana/runtime';
import { Alert, Button } from '@grafana/ui';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';

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
          <div id="angular-deprecation-notice">
            <Alert
              severity="warning"
              // BMC Change: Next line inline
              title="This dashboard uses deprecated plug-ins that will be discontinued in an upcoming release. You must replace them with supported plug-ins to avoid any impact to this dashboard."
              onRemove={() => {
                reportInteraction('angular_deprecation_notice_dismissed');
                onDismiss(true);
              }}
            >
              <div className="markdown-html">
                {/* BMC Change Starts */}
                For more information, see the Deprecated and discontinued features topic in product documentation.
                {/* <a
                  href="https://grafana.com/docs/grafana/latest/developers/angular_deprecation/"
                  className="external-link"
                  target="_blank"
                  rel="noreferrer"
                >
                  Read our deprecation notice and migration advice.
                </a> */}
                {/* BMC Change Ends */}
                <br />

                {showAutoMigrateLink && (
                  <Button fill="outline" size="sm" onClick={tryMigration} style={{ marginTop: 10 }}>
                    Try migration
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
