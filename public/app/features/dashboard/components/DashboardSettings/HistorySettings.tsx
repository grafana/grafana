import React from 'react';
import { useAsync } from 'react-use';

import { Page } from 'app/core/components/PageNew/Page';
import { getGrafanaStorage } from 'app/features/storage/storage';

import { SettingsPageProps } from './types';

export function HistorySettings({ dashboard, sectionNav }: SettingsPageProps) {
  const history = useAsync(() => {
    return getGrafanaStorage().history({
      kind: 'dashboard',
      scope: 'drive',
      UID: dashboard.uid,
    });
  }, [dashboard.uid]);

  return (
    <Page navModel={sectionNav}>
      {history.value && (
        <div>
          {history.value.versions.map((v) => (
            <div key={v.version}>
              <a href={`${location.pathname}@${v.version}`}>
                <pre>{JSON.stringify(v, null, 2)}</pre>
              </a>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
