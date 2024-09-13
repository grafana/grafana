import { css } from '@emotion/css';
import { useState } from 'react';
import { Trans } from 'react-i18next';
import { Redirect } from 'react-router-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, sceneGraph, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Box, Button, Icon, Stack, TextLink, useStyles2 } from '@grafana/ui';
import { Text } from '@grafana/ui/src/components/Text/Text';

import { DataTrail } from './DataTrail';
import { DataTrailCard } from './DataTrailCard';
import { DataTrailsApp } from './DataTrailsApp';
import { getBookmarkKey, getTrailStore } from './TrailStore/TrailStore';
import { reportExploreMetrics } from './interactions';
import { getDatasourceForNewTrail, getUrlForTrail, newMetricsTrail } from './utils';

export interface DataTrailsHomeState extends SceneObjectState {}

export class DataTrailsHome extends SceneObjectBase<DataTrailsHomeState> {
  public constructor(state: DataTrailsHomeState) {
    super(state);
  }

  // button: new metric exploration
  public onNewMetricsTrail = () => {
    const app = getAppFor(this);
    const trail = newMetricsTrail(getDatasourceForNewTrail());
    reportExploreMetrics('exploration_started', { cause: 'new_clicked' });
    getTrailStore().setRecentTrail(trail);
    app.goToUrlForTrail(trail);
  };

  // called when you click on a recent metric exploration card
  public onSelectRecentTrail = (trail: DataTrail) => {
    const app = getAppFor(this);
    reportExploreMetrics('exploration_started', { cause: 'recent_clicked' });
    getTrailStore().setRecentTrail(trail);
    app.goToUrlForTrail(trail);
  };

  // called when you click on a bookmark card
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

    const onDelete = (index: number) => {
      getTrailStore().removeBookmark(index);
      reportExploreMetrics('bookmark_changed', { action: 'deleted' });
      setLastDelete(Date.now()); // trigger re-render
    };

    // current/old code: if there are no recent trails, show metrics select page (all metrics)
    // probably need to change this logic to - if there are recent trails, show the sparklines, etc
    // If there are no recent trails, don't show home page and create a new trail
    // if (!getTrailStore().recent.length) {
    //   const trail = newMetricsTrail(getDatasourceForNewTrail());
    //   return <Redirect to={getUrlForTrail(trail)} />;
    // }

    return (
      <div className={styles.container}>
        <div className={styles.homepageBox}>
          <Stack direction="column" alignItems="center" gap={2}>
            <div className={styles.rocket}>
              <Icon name="rocket" style={{ width: '100%', height: 'auto' }} size="xxxl" />
            </div>
            <Text element="h1" textAlignment="center" weight="medium">
              {/* have to add i18nKey */}
              <Trans>Start your metrics exploration!</Trans>
            </Text>
            {/* <Box marginBottom={1} paddingX={4} > */}
            <Box paddingX={4} gap={3}>
              <Text element="p" textAlignment="center" color="secondary">
                {/* have to add i18nKey */}
                <Trans>Explore your Prometheus-compatible metrics without writing a query.</Trans>
                <TextLink
                  href="https://grafana.com/docs/grafana/latest/explore/explore-metrics/"
                  external
                  style={{ marginLeft: '8px' }}
                >
                  Learn more
                </TextLink>
              </Text>
            </Box>
            <Button size="lg" variant="primary" onClick={model.onNewMetricsTrail}>
              <div className={styles.startButton}>
                <Trans>Let's start!</Trans>
              </div>
              <Icon name="arrow-right" size="lg" style={{ marginLeft: '8px' }} />
            </Button>
          </Stack>
        </div>
        {/* separate recent metircs + bookmarks code into separate components, then can conditionally render based on if there's a length */}
        <Stack gap={5}>
          <div className={styles.column}>
            <Text variant="h4">Recent metrics explorations</Text>
            <div className={styles.trailList}>
              {getTrailStore().recent.map((trail, index) => {
                const resolvedTrail = trail.resolve();
                return (
                  <DataTrailCard
                    key={(resolvedTrail.state.key || '') + index}
                    trail={resolvedTrail}
                    onSelect={() => model.onSelectRecentTrail(resolvedTrail)}
                  />
                );
              })}
            </div>
          </div>
          <div className={styles.verticalLine} />
          <div className={styles.column}>
            <Text variant="h4">Bookmarks</Text>
            <div className={styles.trailList}>
              {getTrailStore().bookmarks.map((bookmark, index) => {
                return (
                  <DataTrailCard
                    key={getBookmarkKey(bookmark)}
                    bookmark={bookmark}
                    onSelect={() => model.onSelectBookmark(index)}
                    onDelete={() => onDelete(index)}
                  />
                );
              })}
            </div>
          </div>
        </Stack>
      </div>
    );
  };
}

function getAppFor(model: SceneObject) {
  return sceneGraph.getAncestor(model, DataTrailsApp);
}

function getStyles(theme: GrafanaTheme2) {
  return {
    homepageBox: css({
      backgroundColor: theme.colors.background.secondary,
      display: 'flex',
      width: '725px',
      height: '294px',
      padding: '40px 32px',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '24px',
      flexShrink: 0,
    }),
    rocket: css({
      vectorEffect: 'non-scaling-stroke', // currently not working
    }),
    startButton: css({
      fontWeight: theme.typography.fontWeightLight,
    }),
    container: css({
      alignItems: 'center',
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(3),
    }),
    column: css({
      display: 'flex',
      flexGrow: 1,
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
    newTrail: css({
      height: 'auto',
      justifyContent: 'center',
      fontSize: theme.typography.h5.fontSize,
    }),
    trailCard: css({}),
    trailList: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
    verticalLine: css({
      borderLeft: `1px solid ${theme.colors.border.weak}`,
    }),
  };
}
