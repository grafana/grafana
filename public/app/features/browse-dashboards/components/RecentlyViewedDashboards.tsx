import { css } from '@emotion/css';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { evaluateBooleanFlag } from '@grafana/runtime/internal';
import { CollapsableSection, Link, Spinner, Text, useStyles2 } from '@grafana/ui';

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
