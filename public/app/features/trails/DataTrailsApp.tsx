import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom-v5-compat';

import { PageLayoutType } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneScopesBridge,
  UrlSyncContextProvider,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui/';
import { Page } from 'app/core/components/Page/Page';
import { ScopesSelector } from 'app/features/scopes/selector/ScopesSelector';

import { AppChromeUpdate } from '../../core/components/AppChrome/AppChromeUpdate';

import { DataTrail } from './DataTrail';
import { DataTrailsHome } from './DataTrailsHome';
import { getTrailStore } from './TrailStore/TrailStore';
import { HOME_ROUTE, RefreshMetricsEvent, TRAILS_ROUTE } from './shared';
import { getMetricName, getUrlForTrail, newMetricsTrail } from './utils';

export interface DataTrailsAppState extends SceneObjectState {
  trail: DataTrail;
  home: DataTrailsHome;
  scopesBridge?: SceneScopesBridge | undefined;
}

export class DataTrailsApp extends SceneObjectBase<DataTrailsAppState> {
  protected _renderBeforeActivation = true;

  public constructor(state: DataTrailsAppState) {
    super(state);
  }

  goToUrlForTrail(trail: DataTrail) {
    locationService.push(getUrlForTrail(trail));
    this.setState({ trail });
  }

  static Component = ({ model }: SceneComponentProps<DataTrailsApp>) => {
    const { trail, home, scopesBridge } = model.useState();

    return (
      <>
        {scopesBridge && <SceneScopesBridge.Component model={scopesBridge} />}
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
      </>
    );
  };
}

function DataTrailView({ trail }: { trail: DataTrail }) {
  const styles = useStyles2(getStyles);
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
        {config.featureToggles.singleTopNav && config.featureToggles.enableScopesInMetricsExplore && (
          <AppChromeUpdate
            actions={
              <div className={styles.topNavContainer}>
                <ScopesSelector />
              </div>
            }
          />
        )}
        <trail.Component model={trail} />
      </Page>
    </UrlSyncContextProvider>
  );
}

let dataTrailsApp: DataTrailsApp;

export function getDataTrailsApp() {
  if (!dataTrailsApp) {
    const scopesBridge =
      config.featureToggles.scopeFilters && config.featureToggles.enableScopesInMetricsExplore
        ? new SceneScopesBridge({})
        : undefined;

    dataTrailsApp = new DataTrailsApp({
      trail: newMetricsTrail(),
      home: new DataTrailsHome({}),
      scopesBridge,
      $behaviors: [
        () => {
          scopesBridge?.enable();

          const sub = scopesBridge?.subscribeToValue(() => {
            dataTrailsApp.state.trail.publishEvent(new RefreshMetricsEvent());
            dataTrailsApp.state.trail.checkDataSourceForOTelResources();
          });

          return () => {
            scopesBridge?.disable();
            sub?.unsubscribe();
          };
        },
      ],
    });
  }

  return dataTrailsApp;
}

const getStyles = () => ({
  topNavContainer: css({
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyItems: 'flex-start',
  }),
});
