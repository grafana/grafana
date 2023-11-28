import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Icon } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { useGetFeatureTogglesQuery, useGetManagerStateQuery } from './AdminFeatureTogglesAPI';
import { AdminFeatureTogglesTable } from './AdminFeatureTogglesTable';

export default function AdminFeatureTogglesPage() {
  const { data: featureToggles, isLoading, isError } = useGetFeatureTogglesQuery();
  const { data: featureMgmtState } = useGetManagerStateQuery();
  const [updateSuccessful, setUpdateSuccessful] = useState(false);

  const styles = useStyles2(getStyles);

  const getErrorMessage = () => {
    return 'Error fetching feature toggles';
  };

  const handleUpdateSuccess = () => {
    setUpdateSuccessful(true);
  };

  const AlertMessage = () => {
    return (
      <div className={styles.warning}>
        <div className={styles.icon}>
          <Icon name="exclamation-triangle" />
        </div>
        <span className={styles.message}>
          {featureMgmtState?.restartRequired || updateSuccessful
            ? 'A restart is pending for your Grafana instance to apply the latest feature toggle changes'
            : 'Saving feature toggle changes will prompt a restart of the instance, which may take a few minutes'}
        </span>
      </div>
    );
  };

  return (
    <Page navId="feature-toggles">
      <Page.Contents>
        <>
          {isError && getErrorMessage()}
          {isLoading && 'Fetching feature toggles'}
          <AlertMessage />
          {featureToggles && (
            <AdminFeatureTogglesTable featureToggles={featureToggles} onUpdateSuccess={handleUpdateSuccess} />
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
      marginTop: theme.spacing(3),
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
