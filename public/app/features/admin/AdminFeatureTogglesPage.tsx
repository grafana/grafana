import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Icon } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { togglesApi } from './AdminFeatureTogglesAPI';
import { AdminFeatureTogglesTable } from './AdminFeatureTogglesTable';

export default function AdminFeatureTogglesPage() {
  const [reload] = useState(1);
  const featureMgmtState = useAsync(() => togglesApi.getManagerState(), [reload]);
  const featureToggles = useAsync(() => togglesApi.getFeatureToggles(), [reload]);
  const [updateSuccessful, setUpdateSuccessful] = useState(false);
  const styles = useStyles2(getStyles);

  const handleUpdateSuccess = () => {
    setUpdateSuccessful(true);
    // setReload(reload+1); << would trigger updating the server state!
  };

  const EditingAlert = () => {
    return (
      <div className={styles.warning}>
        <div className={styles.icon}>
          <Icon name="exclamation-triangle" />
        </div>
        <span className={styles.message}>
          {featureMgmtState.value?.restartRequired || updateSuccessful
            ? 'A restart is pending for your Grafana instance to apply the latest feature toggle changes'
            : 'Saving feature toggle changes will prompt a restart of the instance, which may take a few minutes'}
        </span>
      </div>
    );
  };

  const subTitle = (
    <div>
      View and edit feature toggles. Read more about feature toggles at{' '}
      <a
        className="external-link"
        target="_new"
        href="https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles/"
      >
        grafana.com
      </a>
      .
    </div>
  );

  return (
    <Page navId="feature-toggles" subTitle={subTitle}>
      <Page.Contents isLoading={featureToggles.loading}>
        <>
          {featureToggles.error}
          {featureToggles.loading && 'Fetching feature toggles'}

          {featureMgmtState.value && <EditingAlert />}
          {featureToggles.value && (
            <AdminFeatureTogglesTable
              featureToggles={featureToggles.value}
              allowEditing={featureMgmtState.value?.allowEditing || false}
              onUpdateSuccess={handleUpdateSuccess}
            />
          )}
        </>
      </Page.Contents>
    </Page>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    warning: css({
      display: 'flex',
      marginTop: theme.spacing(0.25),
      marginBottom: theme.spacing(0.25),
    }),
    icon: css({
      color: theme.colors.warning.main,
      paddingRight: theme.spacing(),
    }),
    message: css({
      color: theme.colors.text.secondary,
      marginTop: theme.spacing(0.25),
    }),
  };
}
