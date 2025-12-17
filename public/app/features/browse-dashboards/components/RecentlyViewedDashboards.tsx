import { css } from '@emotion/css';
import { useState } from 'react';
import { useAsyncRetry } from 'react-use';

import { GrafanaTheme2, store } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { evaluateBooleanFlag } from '@grafana/runtime/internal';
import { Button, CollapsableSection, Spinner, Stack, Text, useStyles2, Grid } from '@grafana/ui';
import { useDashboardLocationInfo } from 'app/features/search/hooks/useDashboardLocationInfo';
import { DashListItem } from 'app/plugins/panel/dashlist/DashListItem';

import { getRecentlyViewedDashboards } from './utils';

const MAX_RECENT = 5;

const recentDashboardsKey = `dashboard_impressions-${config.bootData.user.orgId}`;

export function RecentlyViewedDashboards() {
  const [isOpen, setIsOpen] = useState(true);

  const styles = useStyles2(getStyles);

  const {
    value: recentDashboards = [],
    loading,
    retry,
  } = useAsyncRetry(async () => {
    if (!evaluateBooleanFlag('recentlyViewedDashboards', false)) {
      return [];
    }
    return getRecentlyViewedDashboards(MAX_RECENT);
  }, []);
  const { foldersByUid } = useDashboardLocationInfo(recentDashboards.length > 0);

  const handleClearHistory = () => {
    store.set(recentDashboardsKey, JSON.stringify([]));
    retry();
  };

  if (!evaluateBooleanFlag('recentlyViewedDashboards', false)) {
    return null;
  }

  return (
    <CollapsableSection
      headerDataTestId="browseDashboardsRecentlyViewedTitle"
      label={
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" width="100%">
          <Text variant="h5" element="h3" onClick={() => setIsOpen(!isOpen)}>
            <Trans i18nKey="browse-dashboards.recently-viewed.title">Recently viewed</Trans>
          </Text>
          <Button icon="times" size="xs" variant="secondary" fill="text" onClick={handleClearHistory}>
            {t('browse-dashboards.recently-viewed.clear', 'Clear history')}
          </Button>
        </Stack>
      }
      isOpen={isOpen}
      // passing empty function to disable controlled mode, we only want to control isOpen when click on title
      // this avoid entire header section being clickable which can be confusing with the Clear history button
      onToggle={() => {}}
      className={styles.title}
      contentClassName={styles.content}
    >
      {/* placeholder */}
      {loading && <Spinner />}
      {/* TODO: Better empty state https://github.com/grafana/grafana/issues/114804 */}
      {!loading && recentDashboards.length === 0 && (
        <Text>{t('browse-dashboards.recently-viewed.empty', 'Nothing viewed yet')}</Text>
      )}

      {!loading && recentDashboards.length > 0 && (
        <ul className={styles.list}>
          <Grid columns={{ xs: 1, sm: 2, md: 3, lg: 5 }} gap={2}>
            {recentDashboards.map((dash) => (
              <li key={dash.uid} className={styles.listItem}>
                <DashListItem
                  key={dash.uid}
                  dashboard={dash}
                  url={dash.url}
                  showFolderNames={true}
                  locationInfo={foldersByUid[dash.location]}
                  layoutMode="card"
                />
              </li>
            ))}
          </Grid>
        </ul>
      )}
    </CollapsableSection>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    title: css({
      cursor: 'default',
      '& [id^="collapse-button-"] svg': {
        color: theme.colors.primary.text,
      },
      h3: {
        background: `linear-gradient(90deg, ${theme.colors.primary.shade} 0%, ${theme.colors.primary.text} 100%)`,
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        color: 'transparent',
        cursor: 'pointer',
      },
    }),
    content: css({
      paddingTop: theme.spacing(0),
    }),
    list: css({
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'grid',
      gap: theme.spacing(2),
    }),
    listItem: css({
      margin: 0,
    }),
  };
};
