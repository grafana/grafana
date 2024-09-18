import { css } from '@emotion/css';
import { useState } from 'react';
import { Trans } from 'react-i18next';

import { GrafanaTheme2 } from '@grafana/data';
import {
  AdHocFiltersVariable,
  DataSourceVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { Box, Button, Icon, Stack, TextLink, useStyles2 } from '@grafana/ui';
import { Text } from '@grafana/ui/src/components/Text/Text';

import { DataTrail } from './DataTrail';
// import { DataTrailCard } from './DataTrailCard';
import { DataTrailsApp } from './DataTrailsApp';
// import { DataTrailsBookmarks } from './DataTrailsBookmarks';
import { RecentExplorationScene, RecentExplorationState } from './DataTrailsRecentMetrics';
import { getTrailStore } from './TrailStore/TrailStore';
import { reportExploreMetrics } from './interactions';
import { VAR_DATASOURCE, VAR_FILTERS } from './shared';
import { getDatasourceForNewTrail, getUrlForTrail, newMetricsTrail } from './utils';

export interface DataTrailsHomeState extends SceneObjectState {
  recentExplorations?: RecentExplorationScene[];
}

export class DataTrailsHome extends SceneObjectBase<DataTrailsHomeState> {
  public constructor(state: DataTrailsHomeState) {
    super(state);

    this.addActivationHandler(this._onActivate.bind(this));
  }
  private _onActivate() {
    // where we make the list of recent explorations
    // say what type to type the array
    if (this.state.recentExplorations === undefined) {
      const recentExplorations = getTrailStore().recent.map((trail, index) => {
        const resolvedTrail = trail.resolve();
        const state: RecentExplorationState = {
          metric: resolvedTrail.state.metric,
          createdAt: resolvedTrail.state.createdAt,
          $timeRange: resolvedTrail.state.$timeRange,
        };
        const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, resolvedTrail); // sceneGraph is a bunch of utility methods that lets you get things from graph of scene objects that something belongs to
        // resolvedTrail is what we want to show in the box,
        if (filtersVariable instanceof AdHocFiltersVariable) {
          console.log('in filtersVariable if statement!!!');
          state.filters = filtersVariable.state.filters;
        }
        console.log('after if statement, filtersVariable: ', filtersVariable);
        const datasourceVariable = sceneGraph.lookupVariable(VAR_DATASOURCE, resolvedTrail);
        // is this object you gave me an instance of DAtaSourceVariable
        if (datasourceVariable instanceof DataSourceVariable) {
          state.datasource = datasourceVariable?.state.value.toString();
        }
        return new RecentExplorationScene(state);
      });
      this.setState({ recentExplorations });
    }
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

    const { recentExplorations } = model.useState(); // current state list of recent explorations in scene format, we want to iterate over it with map

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
          <Stack direction="column" alignItems="center">
            <div className={styles.rocket}>
              {/* <Icon name="rocket" style={{ width: '100%', height: 'auto' }} size="xxxl" /> */}
              <svg xmlns="http://www.w3.org/2000/svg" width="73" height="72" viewBox="0 0 73 72" fill="none">
                <path
                  d="M65.3 8.09993C65.3 7.49993 64.7 7.19993 64.1 6.89993C52.7 3.89993 40.4 7.79993 32.9 16.7999L29 21.2999L20.9 19.1999C17.6 17.9999 14.3 19.4999 12.8 22.4999L6.49999 33.5999C6.49999 33.5999 6.49999 33.8999 6.19999 33.8999C5.89999 34.7999 6.49999 35.3999 7.39999 35.6999L17.6 37.7999C16.7 40.4999 15.8 43.1999 15.5 45.8999C15.5 46.4999 15.5 46.7999 15.8 47.0999L24.8 55.7999C25.1 56.0999 25.4 56.0999 26 56.0999C28.7 55.7999 31.7 55.1999 34.4 54.2999L36.5 64.1999C36.5 64.7999 37.4 65.3999 38 65.3999C38.3 65.3999 38.6 65.3999 38.6 65.0999L49.7 58.7999C52.4 57.2999 53.6 53.9999 53 50.9999L50.9 42.2999L55.1 38.3999C64.4 31.4999 68.3 19.4999 65.3 8.09993ZM10.1 33.2999L15.2 23.9999C16.1 22.1999 17.9 21.5999 19.7 22.1999L26.6 23.9999L23.6 27.5999C21.8 29.9999 20 32.3999 18.8 35.0999L10.1 33.2999ZM48.5 56.9999L39.2 62.3999L37.4 53.6999C40.1 52.4999 42.5 50.6999 44.9 48.8999L48.8 45.2999L50.6 52.1999C50.6 53.9999 50 56.0999 48.5 56.9999ZM53.3 36.8999L42.8 46.4999C38.3 50.3999 32.6 52.7999 26.6 53.3999L18.8 45.5999C19.7 39.5999 22.1 33.8999 26 29.3999L30.8 23.9999L31.1 23.6999L35.3 18.8999C41.9 11.0999 52.7 7.49993 62.6 9.59993C64.7 19.7999 61.4 30.2999 53.3 36.8999ZM49.7 16.7999C46.4 16.7999 44 19.4999 44 22.4999C44 25.4999 46.7 28.1999 49.7 28.1999C53 28.1999 55.4 25.4999 55.4 22.4999C55.4 19.4999 53 16.7999 49.7 16.7999ZM49.7 25.4999C48.2 25.4999 47 24.2999 47 22.7999C47 21.2999 48.2 20.0999 49.7 20.0999C51.2 20.0999 52.4 21.2999 52.4 22.7999C52.4 24.2999 51.2 25.4999 49.7 25.4999Z"
                  fill="#CCCCDC"
                  fillOpacity="0.65"
                />
              </svg>
            </div>
            <Text element="h1" textAlignment="center" weight="medium">
              {/* have to add i18nKey */}
              <Trans>Start your metrics exploration!</Trans>
            </Text>
            {/* <Box marginBottom={1} paddingX={4} > */}
            <Box>
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
            <div className={styles.gap24}>
              <Button size="lg" variant="primary" onClick={model.onNewMetricsTrail}>
                <div className={styles.startButton}>
                  <Trans>Let's start!</Trans>
                </div>
                <Icon name="arrow-right" size="lg" style={{ marginLeft: '8px' }} />
              </Button>
            </div>
          </Stack>
        </div>
        {/* separate recent metircs + bookmarks code into separate components, then can conditionally render based on if there's a length */}
        {/* <Stack gap={5}> */}
        <div className={styles.column}>
          <Text variant="h4">Recent metrics explorations</Text>
          <div className={styles.trailList}>
            {recentExplorations &&
              recentExplorations.map((recent, index) => {
                return (
                  <recent.Component model={recent} key={recent.state.key} /> // how we mount a scene inside of react
                  // <DataTrailCard
                  //   key={(resolvedTrail.state.key || '') + index}
                  //   trail={resolvedTrail}
                  //   onSelect={() => model.onSelectRecentTrail(resolvedTrail)}
                  // />
                );
              })}
          </div>
        </div>
        <div className={styles.verticalLine} />
        {/* <DataTrailsBookmarks /> */}
        {/* <div className={styles.column}>
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
          </div> */}
        {/* </Stack> */}
      </div>
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
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column',
      gap: theme.spacing(3),
      height: '100%',
      boxSizing: 'border-box', // Ensure padding doesn't cause overflow
    }),
    homepageBox: css({
      backgroundColor: theme.colors.background.secondary,
      width: '725px',
      height: '294px',
      padding: '40px 32px',
      gap: '24px',
      boxSizing: 'border-box', // Ensure padding doesn't cause overflow
      flexShrink: 0,
    }),
    rocket: css({
      vectorEffect: 'non-scaling-stroke', // currently not working
    }),
    startButton: css({
      fontWeight: theme.typography.fontWeightLight,
    }),
    column: css({
      display: 'flex',
      flexGrow: 1,
      flexDirection: 'column',
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
    gap24: css({
      marginTop: theme.spacing(2), // Adds a 24px gap since there is already a 8px gap from the button
    }),
  };
}
