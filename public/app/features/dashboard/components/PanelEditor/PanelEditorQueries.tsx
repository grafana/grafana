import React, { PureComponent } from 'react';

import { DataQuery, getDataSourceRef } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import store from 'app/core/store';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { QueryGroup } from 'app/features/query/components/QueryGroup';
import { QueryGroupDataSource, QueryGroupOptions } from 'app/types';

import { PanelModel } from '../../state';

interface Props {
  /** Current panel */
  panel: PanelModel;
  /** Added here to make component re-render when queries change from outside */
  queries: DataQuery[];
  dashboardUid?: string;
}

const PANEL_EDIT_LAST_USED_DATASOURCE = 'grafana.dashboards.panelEdit.lastUsedDatasource';

type LastUsedDatasource =
  | {
      dashboardUid: string;
      datasourceUid: string;
    }
  | undefined;

export class PanelEditorQueries extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }
  getLastUsedDatasource = () => {
    const lastUsedDatasource: LastUsedDatasource = store.getObject(PANEL_EDIT_LAST_USED_DATASOURCE);
    return lastUsedDatasource;
  };

  updateLastUsedDatasource = (datasource: QueryGroupDataSource) => {
    if (store.exists(PANEL_EDIT_LAST_USED_DATASOURCE)) {
      const lastUsedDatasource: LastUsedDatasource = store.getObject(PANEL_EDIT_LAST_USED_DATASOURCE);

      if (lastUsedDatasource?.dashboardUid === this.props.dashboardUid) {
        if (lastUsedDatasource?.datasourceUid !== datasource.uid) {
          store.setObject(PANEL_EDIT_LAST_USED_DATASOURCE, {
            dashboardUid: this.props.dashboardUid,
            datasourceUid: datasource.uid,
          });
        }
      }
    } else {
      store.setObject(PANEL_EDIT_LAST_USED_DATASOURCE, {
        dashboardUid: this.props.dashboardUid,
        datasourceUid: datasource.uid,
      });
    }
  };

  buildQueryOptions(panel: PanelModel): QueryGroupOptions {
    const dataSource: QueryGroupDataSource = panel.datasource ?? {
      default: true,
    };
    const datasourceSettings = getDatasourceSrv().getInstanceSettings(dataSource);

    // store last datasource used in local storage
    this.updateLastUsedDatasource(dataSource);
    return {
      cacheTimeout: datasourceSettings?.meta.queryOptions?.cacheTimeout ? panel.cacheTimeout : undefined,
      dataSource: {
        default: datasourceSettings?.isDefault,
        type: datasourceSettings?.type,
        uid: datasourceSettings?.uid,
      },
      queryCachingTTL: datasourceSettings?.cachingConfig?.enabled ? panel.queryCachingTTL : undefined,
      queries: panel.targets,
      maxDataPoints: panel.maxDataPoints,
      minInterval: panel.interval,
      timeRange: {
        from: panel.timeFrom,
        shift: panel.timeShift,
        hide: panel.hideTimeOverride,
      },
    };
  }

  async componentDidMount() {
    const { panel } = this.props;

    // If the panel model has no datasource property load the default data source property and update the persisted model
    // Because this part of the panel model is not in redux yet we do a forceUpdate.
    if (!panel.datasource) {
      let ds;
      // check if we have last used datasource from local storage
      if (store.exists(PANEL_EDIT_LAST_USED_DATASOURCE)) {
        const lastUsedDatasource = this.getLastUsedDatasource();
        // do we have a last used datasource for this dashboard
        if (lastUsedDatasource?.dashboardUid === this.props.dashboardUid) {
          if (lastUsedDatasource?.datasourceUid !== null) {
            // get datasource from uid
            ds = getDatasourceSrv().getInstanceSettings(lastUsedDatasource?.datasourceUid);
            // if the datasource uid is not found, load default datasource
          }
        }
      }
      // else load default datasource
      if (!ds) {
        ds = getDatasourceSrv().getInstanceSettings(null);
      }
      panel.datasource = getDataSourceRef(ds!);
      this.forceUpdate();
    }
  }

  onRunQueries = () => {
    this.props.panel.refresh();
  };

  onOpenQueryInspector = () => {
    locationService.partial({
      inspect: this.props.panel.id,
      inspectTab: 'query',
    });
  };

  onOptionsChange = (options: QueryGroupOptions) => {
    const { panel } = this.props;

    panel.updateQueries(options);

    if (options.dataSource.uid !== panel.datasource?.uid) {
      // trigger queries when changing data source
      setTimeout(this.onRunQueries, 10);
    }

    this.forceUpdate();
  };

  render() {
    const { panel } = this.props;

    // If no panel data soruce set, wait with render. Will be set to default in componentDidMount
    if (!panel.datasource) {
      return null;
    }

    const options = this.buildQueryOptions(panel);

    return (
      <QueryGroup
        options={options}
        queryRunner={panel.getQueryRunner()}
        onRunQueries={this.onRunQueries}
        onOpenQueryInspector={this.onOpenQueryInspector}
        onOptionsChange={this.onOptionsChange}
      />
    );
  }
}
