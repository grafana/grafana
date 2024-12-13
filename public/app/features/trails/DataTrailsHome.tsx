import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, sceneGraph, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Box, Button, Icon, Stack, TextLink, useStyles2, useTheme2 } from '@grafana/ui';
import { Text } from '@grafana/ui/src/components/Text/Text';
import { Trans } from 'app/core/internationalization';

import { DataTrail } from './DataTrail';
import { DataTrailsBookmarks } from './DataTrailBookmarks';
import { DataTrailsApp } from './DataTrailsApp';
import { DataTrailsRecentMetrics } from './DataTrailsRecentMetrics';
import { getTrailStore } from './TrailStore/TrailStore';
import { LightModeRocket, DarkModeRocket } from './assets/rockets';
import { reportExploreMetrics } from './interactions';
import { getDatasourceForNewTrail, newMetricsTrail } from './utils';

export interface DataTrailsHomeState extends SceneObjectState {}

export class DataTrailsHome extends SceneObjectBase<DataTrailsHomeState> {
  public constructor(state: DataTrailsHomeState) {
    super(state);
  }

  public onNewMetricsTrail = () => {
    const app = getAppFor(this);
    const trail = newMetricsTrail(getDatasourceForNewTrail());
    reportExploreMetrics('exploration_started', { cause: 'new_clicked' });
    app.goToUrlForTrail(trail);
  };

  public onSelectRecentTrail = (trail: DataTrail) => {
    const app = getAppFor(this);
    reportExploreMetrics('exploration_started', { cause: 'recent_clicked' });
    getTrailStore().setRecentTrail(trail);
    app.goToUrlForTrail(trail);
  };

  public onSelectBookmark = (bookmarkIndex: number) => {
    const app = getAppFor(this);
    reportExploreMetrics('exploration_started', { cause: 'bookmark_clicked' });
    const trail = getTrailStore().getTrailForBookmarkIndex(bookmarkIndex);
    getTrailStore().setRecentTrail(trail);
    app.goToUrlForTrail(trail);
  };

  static Component = ({ model }: SceneComponentProps<DataTrailsHome>) => {
    const [_, setLastDelete] = useState(Date.now());
    const styles = useStyles2(getStyles);
    const theme = useTheme2();

    const onDelete = (index: number) => {
      getTrailStore().removeBookmark(index);
      reportExploreMetrics('bookmark_changed', { action: 'deleted' });
      setLastDelete(Date.now()); // trigger re-render
    };

    return (
      <article className={styles.container}>
        <section className={styles.homepageBox}>
          <Stack direction="column" alignItems="center">
            <div>{theme.isDark ? <DarkModeRocket /> : <LightModeRocket />}</div>
            <Text element="h1" textAlignment="center" weight="medium">
              <Trans i18nKey="trails.home.start-your-metrics-exploration">Start your metrics exploration!</Trans>
            </Text>
            <Box>
              <Text element="p" textAlignment="center" color="secondary">
                <Trans i18nKey="trails.home.subtitle">
                  Explore your Prometheus-compatible metrics without writing a query.
                </Trans>
                <TextLink
                  href="https://grafana.com/docs/grafana/latest/explore/explore-metrics/"
                  external
                  style={{ marginLeft: '8px' }}
                >
                  <Trans i18nKey="trails.home.learn-more">Learn more</Trans>
                </TextLink>
              </Text>
            </Box>
            <div className={styles.gap24}>
              <Button size="lg" variant="primary" onClick={model.onNewMetricsTrail}>
                <div className={styles.startButton}>
                  <Trans i18nKey="trails.home.lets-start">Let&apos;s start!</Trans>
                </div>
                <Icon name="arrow-right" size="lg" style={{ marginLeft: '8px' }} />
              </Button>
            </div>
          </Stack>
        </section>
        <DataTrailsRecentMetrics onSelect={model.onSelectRecentTrail} />
        <DataTrailsBookmarks onSelect={model.onSelectBookmark} onDelete={onDelete} />
      </article>
    );
  };
}

function getAppFor(model: SceneObject) {
  return sceneGraph.getAncestor(model, DataTrailsApp);
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      alignItems: 'center',
      marginTop: '84px',
      flexDirection: 'column',
      height: '100%',
      boxSizing: 'border-box', // Ensure padding doesn't cause overflow
    }),
    homepageBox: css({
      backgroundColor: theme.colors.background.secondary,
      width: '904px',
      padding: '80px 32px',
      boxSizing: 'border-box', // Ensure padding doesn't cause overflow
      flexShrink: 0,
    }),
    startButton: css({
      fontWeight: theme.typography.fontWeightLight,
    }),
    gap24: css({
      marginTop: theme.spacing(2), // Adds a 24px gap since there is already a 8px gap from the button
    }),
  };
}
