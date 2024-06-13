import React, { useEffect } from 'react';
import { Route, Switch } from 'react-router-dom';

import { PageLayoutType } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, UrlSyncContextProvider } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';

import { DataTrail } from './DataTrail';
import { DataTrailsHome } from './DataTrailsHome';
import { MetricsHeader } from './MetricsHeader';
import { getTrailStore } from './TrailStore/TrailStore';
import { HOME_ROUTE, TRAILS_ROUTE } from './shared';
import { getUrlForTrail, newMetricsTrail } from './utils';

export interface DataTrailsAppState extends SceneObjectState {
  trail: DataTrail;
  home: DataTrailsHome;
}

export class DataTrailsApp extends SceneObjectBase<DataTrailsAppState> {
  public constructor(state: DataTrailsAppState) {
    super(state);
  }

  goToUrlForTrail(trail: DataTrail) {
    locationService.push(getUrlForTrail(trail));
    this.setState({ trail });
  }

  static Component = ({ model }: SceneComponentProps<DataTrailsApp>) => {
    const { trail, home } = model.useState();

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
        <Route exact={true} path={TRAILS_ROUTE} render={() => <DataTrailView trail={trail} />} />
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

  return (
    <UrlSyncContextProvider scene={trail}>
      <trail.Component model={trail} />
    </UrlSyncContextProvider>
  );
}

let dataTrailsApp: DataTrailsApp;

export function getDataTrailsApp() {
  if (!dataTrailsApp) {
    dataTrailsApp = new DataTrailsApp({
      trail: getInitialTrail(),
      home: new DataTrailsHome({}),
    });
  }

  return dataTrailsApp;
}

/**
 * Get the initial trail for the app to work with based on the current URL
 *
 * It will either be a new trail that will be started based on the state represented
 * in the URL parameters, or it will be the most recently used trail (according to the trail store)
 * which has its current history step matching the URL parameters.
 *
 * The reason for trying to reinitialize from the recent trail is to resolve an issue
 * where refreshing the browser would wipe the step history. This allows you to preserve
 * it between browser refreshes, or when reaccessing the same URL.
 */
function getInitialTrail() {
  const newTrail = newMetricsTrail();

  // If one of the recent trails is a match to the newTrail derived from the current URL,
  // let's restore that trail so that a page refresh doesn't create a new trail.
  const recentMatchingTrail = getTrailStore().findMatchingRecentTrail(newTrail)?.resolve();

  // If there is a matching trail, initialize with that. Otherwise, use the new trail.
  return recentMatchingTrail || newTrail;
}
