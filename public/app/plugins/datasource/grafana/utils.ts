import { DataFrame, DataFrameJSON, dataFrameToJSON } from '@grafana/data';
import { GRAFANA_DATASOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { PanelModel } from 'app/features/dashboard/state';

import { GrafanaQuery, GrafanaQueryType } from './types';

export const changeToSnapshotData = (frames: DataFrame[], panel: PanelModel) => {
  const snapshot: DataFrameJSON[] = frames.map((f) => dataFrameToJSON(f));

  const query: GrafanaQuery = {
    refId: 'A',
    queryType: GrafanaQueryType.Snapshot,
    snapshot,
    datasource: { uid: GRAFANA_DATASOURCE_NAME },
  };

  panel.updateQueries({
    dataSource: { uid: GRAFANA_DATASOURCE_NAME },
    queries: [query],
  });

  panel.refresh();
};
