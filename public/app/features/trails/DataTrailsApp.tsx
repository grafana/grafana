import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { Route, Switch } from 'react-router-dom';

import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  getUrlSyncManager,
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneTimeRange,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { DataTrail } from './DataTrail';
import { DataTrailsHome } from './DataTrailsHome';
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
          path="/data-trails"
          render={() => (
            <Page navId="data-trails" layout={PageLayoutType.Custom}>
              <div className={styles.customPage}>
                <home.Component model={home} />
              </div>
            </Page>
          )}
        />
        <Route
          exact={true}
          path="/data-trails/trail"
          render={() => (
            <Page navId="data-trails" pageNav={{ text: 'Trail' }} layout={PageLayoutType.Custom}>
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
      getUrlSyncManager().initSync(trail);
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
    dataTrailsApp = new DataTrailsApp({
      trail: newMetricsTrail(),
      home: new DataTrailsHome({
        recent: [
          new DataTrail({
            initialDS: 'gdev-prometheus',
            metric: 'grafana_http_request_duration_seconds_count',
            initialFilters: [{ key: 'job', operator: '=', value: 'grafana' }],
          }).getRef(),
          new DataTrail({
            initialDS: 'gdev-prometheus',
            metric: 'go_memstats_alloc_bytes_total',
            initialFilters: [{ key: 'job', operator: '=', value: 'node_exporter' }],
          }).getRef(),
        ],
        bookmarks: [
          new DataTrail({
            initialDS: 'kCLEK-Cnk',
            $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
            initialFilters: [
              { key: 'job', operator: '=', value: 'production/grafana' },
              { key: 'endpoint', operator: '=', value: 'queryData' },
            ],
          }).getRef(),
          new DataTrail({
            initialDS: 'kCLEK-Cnk',
            metric: 'grafana_plugin_request_duration_seconds_count',
            initialFilters: [
              { key: 'job', operator: '=', value: 'production/grafana' },
              { key: 'cluster', operator: '=', value: 'se-demo-cluster' },
              { key: 'namespace', operator: '=', value: 'production' },
            ],
          }).getRef(),
          new DataTrail({
            initialDS: 'kCLEK-Cnk',
            metric: 'access_evaluation_duration_bucket',
            initialFilters: [
              { key: 'job', operator: '=', value: 'production/grafana' },
              { key: 'cluster', operator: '=', value: 'se-demo-cluster' },
              { key: 'namespace', operator: '=', value: 'production' },
            ],
          }).getRef(),
        ],
      }),
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
