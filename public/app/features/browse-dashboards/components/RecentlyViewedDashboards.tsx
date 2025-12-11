import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { evaluateBooleanFlag } from '@grafana/runtime/internal';
import { CollapsableSection, Link, Text, useStyles2 } from '@grafana/ui';
import { DashboardQueryResult } from 'app/features/search/service/types';

import { getRecentlyViewedDashboards } from './utils';

const MAX_RECENT = 5;

export function RecentlyViewedDashboards() {
  // state
  const [recentDashboards, setRecentDashboards] = useState<DashboardQueryResult[]>([]);
  const [loading, setLoading] = useState(false);

  // hook
  const styles = useStyles2(getStyles);

  const getRecentlyViewedDashboardsList = async () => {
    setLoading(true);
    try {
      const data = await getRecentlyViewedDashboards(MAX_RECENT);
      setRecentDashboards(data);
    } catch (err) {
      // TODO: handle error properly, include user retry option
      console.error(t('browse-dashboards.recently-viewed.error', 'Error loading recently viewed dashboards'), err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getRecentlyViewedDashboardsList();
  }, []);

  if (!evaluateBooleanFlag('recentlyViewedDashboards', false)) {
    return null;
  }

  return (
    <CollapsableSection
      headerDataTestId="browseDashboardsRecentlyViewedTitle"
      label={
        <Text variant="h5" element="h3">
          {t('browse-dashboards.recently-viewed.title', 'Recently Viewed')}
        </Text>
      }
      isOpen={true}
      className={styles.title}
      contentClassName={styles.content}
    >
      {/* placeholder */}
      {loading && <Text>{t('browse-dashboards.recently-viewed.loading', 'Loading…')}</Text>}
      {/* TODO: Better empty state https://github.com/grafana/grafana/issues/114804 */}
      {!loading && recentDashboards.length === 0 && (
        <Text>{t('browse-dashboards.recently-viewed.empty', 'Nothing viewed yet')}</Text>
      )}

      {/* TODO: implement actual card content */}
      {!loading && recentDashboards.length > 0 && (
        <>
          {recentDashboards.map((dash) => (
            <div key={dash.uid}>
              <Link href={dash.url}>{dash.name}</Link>
            </div>
          ))}
        </>
      )}
    </CollapsableSection>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const accent = theme.visualization.getColorByName('purple'); // or your own hex

  return {
    title: css({
      background: `linear-gradient(90deg, ${accent} 0%, #e478eaff 100%)`,
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      color: 'transparent',
      '& button svg': {
        color: accent,
      },
    }),
    content: css({
      paddingTop: theme.spacing(0),
    }),
  };
};
