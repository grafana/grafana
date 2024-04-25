import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { Route, Switch } from 'react-router-dom';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, getUrlSyncManager } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { DataTrail } from './DataTrail';
import { DataTrailsHome } from './DataTrailsHome';
import { MetricsHeader } from './MetricsHeader';
import { getTrailStore } from './TrailStore/TrailStore';
import { HOME_ROUTE, TRAILS_ROUTE } from './shared';
import { getMetricName, getUrlForTrail, newMetricsTrail } from './utils';

export interface DataTrailsAppState extends SceneObjectState {
  trail: DataTrail;
  home: DataTrailsHome;
}

export class DataTrailsApp extends SceneObjectBase<DataTrailsAppState> {
  public constructor(state: DataTrailsAppState) {
    super(state);
  }

  goToUrlForTrail(trail: DataTrail) {
    this.setState({ trail });
    locationService.push(getUrlForTrail(trail));
  }

  static Component = ({ model }: SceneComponentProps<DataTrailsApp>) => {
    const { trail, home } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <Switch>
        <Route
          exact={true}
          path={HOME_ROUTE}
          render={() => (
            <Page
              navId="explore/metrics"
              layout={PageLayoutType.Standard}
              renderTitle={() => <MetricsHeader />}
              subTitle=""
            >
              <home.Component model={home} />
            </Page>
          )}
        />
        <Route
          exact={true}
          path={TRAILS_ROUTE}
          render={() => (
            <Page
              navId="explore/metrics"
              pageNav={{ text: getMetricName(trail.state.metric) }}
              layout={PageLayoutType.Custom}
            >
              <div className={styles.customPage}>
                <DataTrailView trail={trail} />
              </div>
            </Page>
          )}
        />
      </Switch>
    );
  };
}

function DataTrailView({ trail }: { trail: DataTrail }) {
  const [isInitialized, setIsInitialized] = React.useState(false);

  useEffect(() => {
    if (!isInitialized) {
      getTrailStore().setRecentTrail(trail);
      setIsInitialized(true);
    }
  }, [trail, isInitialized]);

  if (!isInitialized) {
    return null;
  }

  return <trail.Component model={trail} />;
}

let dataTrailsApp: DataTrailsApp;

export function getDataTrailsApp() {
  if (!dataTrailsApp) {
    const newTrail = newMetricsTrail();

    // Set the initial state of the newTrail based on the URL,
    // In case we are initializing from an externally created URL or a page reload
    getUrlSyncManager().initSync(newTrail);
    // Remove the URL sync for now. It will be restored on the trail if it is activated.
    getUrlSyncManager().cleanUp(newTrail);

    // If one of the recent trails is a match to the newTrail derived from the current URL,
    // let's restore that trail so that a page refresh doesn't create a new trail.
    const recentMatchingTrail = getTrailStore().findMatchingRecentTrail(newTrail)?.resolve();

    // If there is a matching trail, initialize with that. Otherwise, use the new trail.
    const trail = recentMatchingTrail || newTrail;

    dataTrailsApp = new DataTrailsApp({
      trail,
      home: new DataTrailsHome({}),
    });
  }

  return dataTrailsApp;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    customPage: css({
      padding: theme.spacing(2, 3, 2, 3),
      background: theme.isLight ? theme.colors.background.primary : theme.colors.background.canvas,
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
    }),
  };
}
