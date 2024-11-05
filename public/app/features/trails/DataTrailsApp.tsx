import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom-v5-compat';

import { PageLayoutType } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, UrlSyncContextProvider } from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';

import { DataTrail } from './DataTrail';
import { DataTrailsHome } from './DataTrailsHome';
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
    locationService.push(getUrlForTrail(trail));
    this.setState({ trail });
  }

  static Component = ({ model }: SceneComponentProps<DataTrailsApp>) => {
    const { trail, home } = model.useState();

    return (
      <Routes>
        {/* The routes are relative to the HOME_ROUTE */}
        <Route
          path={'/'}
          element={
            <Page
              navId="explore/metrics"
              layout={PageLayoutType.Standard}
              // Returning null to prevent default behavior which renders a header
              renderTitle={() => null}
              subTitle=""
            >
              <home.Component model={home} />
            </Page>
          }
        />
        <Route path={TRAILS_ROUTE.replace(HOME_ROUTE, '')} element={<DataTrailView trail={trail} />} />
      </Routes>
    );
  };
}

function DataTrailView({ trail }: { trail: DataTrail }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const { metric } = trail.useState();

  useEffect(() => {
    if (!isInitialized) {
      if (trail.state.metric !== undefined) {
        getTrailStore().setRecentTrail(trail);
      }
      setIsInitialized(true);
    }
  }, [trail, isInitialized]);

  if (!isInitialized) {
    return null;
  }

  return (
    <UrlSyncContextProvider scene={trail}>
      <Page navId="explore/metrics" pageNav={{ text: getMetricName(metric) }} layout={PageLayoutType.Custom}>
        <trail.Component model={trail} />
      </Page>
    </UrlSyncContextProvider>
  );
}

let dataTrailsApp: DataTrailsApp;

export function getDataTrailsApp() {
  if (!dataTrailsApp) {
    dataTrailsApp = new DataTrailsApp({
      trail: newMetricsTrail(),
      home: new DataTrailsHome({}),
    });
  }

  return dataTrailsApp;
}
