import { css } from '@emotion/css';
import { useState } from 'react';
import { useAsyncRetry } from 'react-use';

import { GrafanaTheme2, store } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { evaluateBooleanFlag } from '@grafana/runtime/internal';
import { Button, CollapsableSection, Link, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';

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
      cursor: 'default',
      h3: {
        background: `linear-gradient(90deg, ${accent} 0%, #e478eaff 100%)`,
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        color: 'transparent',
        cursor: 'pointer',
      },
      '& [id^="collapse-button-"] svg': {
        color: accent,
      },
    }),
    content: css({
      paddingTop: theme.spacing(0),
    }),
  };
};
