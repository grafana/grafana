import { css } from '@emotion/css';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { evaluateBooleanFlag } from '@grafana/runtime/internal';
import { CollapsableSection, Grid, Spinner, Text, useStyles2 } from '@grafana/ui';
import { useDashboardLocationInfo } from 'app/features/search/hooks/useDashboardLocationInfo';
import { DashListItem } from 'app/plugins/panel/dashlist/DashListItem';

import { getRecentlyViewedDashboards } from './utils';

const MAX_RECENT = 5;

export function RecentlyViewedDashboards() {
  const styles = useStyles2(getStyles);

  const { value: recentDashboards = [], loading } = useAsync(async () => {
    if (!evaluateBooleanFlag('recentlyViewedDashboards', false)) {
      return [];
    }
    return getRecentlyViewedDashboards(MAX_RECENT);
  }, []);
  const { foldersByUid } = useDashboardLocationInfo(recentDashboards.length > 0);

  if (!evaluateBooleanFlag('recentlyViewedDashboards', false)) {
    return null;
  }

  return (
    <CollapsableSection
      headerDataTestId="browseDashboardsRecentlyViewedTitle"
      label={
        <Text variant="h5" element="h3">
          <Trans i18nKey="browse-dashboards.recently-viewed.title">Recently viewed</Trans>
        </Text>
      }
      isOpen={true}
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
  const accent = theme.visualization.getColorByName('purple');
  const blue = theme.visualization.getColorByName('blue');

  return {
    title: css({
      '& button svg': {
        color: accent,
      },
      h3: {
        background: `linear-gradient(90deg, ${accent} 0%, ${blue} 100%)`,
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        color: 'transparent',
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
