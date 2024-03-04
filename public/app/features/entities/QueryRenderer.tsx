import React, { useEffect, useState } from 'react';
import { from, lastValueFrom } from 'rxjs';

import { DataQueryResponseData } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { PanelChrome } from '@grafana/ui';

import { NodeGraph } from '../../plugins/panel/nodeGraph';

import { Query } from './EntityService';

type Props = {
  query: Query;
};

function QueryRenderer(props: Props) {
  const [data, setData] = useState<DataQueryResponseData>();

  useEffect(() => {
    async function fetchData() {
      const dsUID = datasources[props.query.dataSourceUid];

      const ds = await getDataSourceSrv().get(dsUID);
      const res = await lastValueFrom(from(ds.query()));
      setData(res.data);
    }
    fetchData();
  }, [props.query]);

  if (!data) {
    return <div>Loading...</div>;
  }

  switch (props.query.dataSourceUid) {
    case 'tempo-service-graph':
      return (
        <PanelChrome title={`Node graph`}>
          <div style={{ height: 500 }}>
            <NodeGraph dataFrames={data} getLinks={() => []} />
          </div>
        </PanelChrome>
      );

    case 'tempo':
      break;

    case 'prometheus':
      break;

    case 'loki':
      break;

    case 'pyroscope':
      break;
  }
}

const datasources: Record<string, string> = {
  tempo: 'bb14c279-826a-4bf6-90bc-2c4b45082276',
  'tempo-service-graph': 'bb14c279-826a-4bf6-90bc-2c4b45082276',
  prometheus: 'cc1afed6-6493-4f84-9a45-4b607943e6ae',
  loki: 'bc7aa955-45b4-4cb7-9d89-24e2059bf633',
  pyroscope: 'ce484202-49b5-46b9-ad98-165dc8352b8a',
};
