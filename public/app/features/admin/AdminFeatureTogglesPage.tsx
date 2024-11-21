import { css } from '@emotion/css';
import { useState } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Icon } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { Trans } from 'app/core/internationalization';

import { getTogglesAPI } from './AdminFeatureTogglesAPI';
import { AdminFeatureTogglesTable } from './AdminFeatureTogglesTable';

export default function AdminFeatureTogglesPage() {
  const [reload, setReload] = useState(1);
  const togglesApi = getTogglesAPI();
  const featureState = useAsync(() => togglesApi.getFeatureToggles(), [reload]);
  const styles = useStyles2(getStyles);

  const handleUpdateSuccess = () => {
    setReload(reload + 1);
  };

  const EditingAlert = () => {
    return (
      <div className={styles.warning}>
        <div className={styles.icon}>
          <Icon name="exclamation-triangle" />
        </div>
        <span className={styles.message}>
          {featureState.value?.restartRequired
            ? 'A restart is pending for your Grafana instance to apply the latest feature toggle changes'
            : 'Saving feature toggle changes will prompt a restart of the instance, which may take a few minutes'}
        </span>
      </div>
    );
  };

  const subTitle = (
    <div>
      <Trans i18nKey="admin.feature-toggles.sub-title">
        View and edit feature toggles. Read more about feature toggles at{' '}
        <a
          className="external-link"
          target="_new"
          href="https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles/"
        >
          grafana.com
        </a>
        .
      </Trans>
    </div>
  );

  return (
    <Page navId="feature-toggles" subTitle={subTitle}>
      <Page.Contents isLoading={featureState.loading}>
        <>
          {featureState.error}
          {featureState.loading && 'Fetching feature toggles'}

          <EditingAlert />
          {featureState.value && (
            <AdminFeatureTogglesTable
              featureToggles={featureState.value.toggles}
              allowEditing={featureState.value.allowEditing || false}
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
