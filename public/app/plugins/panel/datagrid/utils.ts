import { DataFrame, DataFrameJSON, dataFrameToJSON, DatagridDataChangeEvent } from '@grafana/data';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { GrafanaQuery, GrafanaQueryType } from 'app/plugins/datasource/grafana/types';

export const EMPTY_DF = {
  name: 'A',
  fields: [],
  length: 0,
};

export const GRAFANA_DS = {
  type: 'grafana',
  uid: 'grafana',
};

export const publishSnapshot = (data: DataFrame, panelID: number): void => {
  const snapshot: DataFrameJSON[] = [dataFrameToJSON(data)];
  const dashboard = getDashboardSrv().getCurrent();
  const panelModel = dashboard?.getPanelById(panelID);

  if (dashboard?.panelInEdit?.id === panelID) {
    dashboard?.events.publish({
      type: DatagridDataChangeEvent.type,
      payload: {
        snapshot,
      },
    });
  }

  const query: GrafanaQuery = {
    refId: 'A',
    queryType: GrafanaQueryType.Snapshot,
    snapshot,
    datasource: GRAFANA_DS,
  };

  panelModel!.updateQueries({
    dataSource: GRAFANA_DS,
    queries: [query],
  });

  panelModel!.refresh();
};
