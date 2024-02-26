import React from 'react';

import { reportInteraction } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';

const LOCAL_STORAGE_KEY_PREFIX = 'grafana.angularDeprecation.dashboardNotice.isDismissed';

function localStorageKey(dashboardUid: string): string {
  return LOCAL_STORAGE_KEY_PREFIX + '.' + dashboardUid;
}

export interface Props {
  dashboardUid: string;
  showAutoMigrateLink?: boolean;
}

function autoMigrateHref(): string {
  const autoMigrateParam = '__feature.autoMigrateOldPanels';
  const url = new URL(window.location.toString());
  if (!url.searchParams.has(autoMigrateParam)) {
    url.searchParams.append(autoMigrateParam, 'true');
  }
  return url.toString();
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
                <ul>
                  <li>
                    <a
                      href="https://grafana.com/docs/grafana/latest/developers/angular_deprecation/"
                      className="external-link"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Read our deprecation notice and migration advice.
                    </a>
                  </li>
                  {showAutoMigrateLink && (
                    <li>
                      <a href={autoMigrateHref()} className="external-link" target="_blank" rel="noreferrer">
                        Auto-migrate compatible panels.
                      </a>
                    </li>
                  )}
                </ul>
              </div>
            </Alert>
          </div>
        );
      }}
    </LocalStorageValueProvider>
  );
}
