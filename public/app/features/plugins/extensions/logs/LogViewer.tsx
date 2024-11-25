import { nanoid } from 'nanoid';
import { ReactElement, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { sceneUtils, VizConfigBuilders } from '@grafana/scenes';
import {
  SceneContextProvider,
  useDataTransformer,
  useQueryRunner,
  VizGridLayout,
  VizPanel,
} from '@grafana/scenes-react';
import { Page } from 'app/core/components/Page/Page';

import { LogFilter, LogViewFilters } from './LogViewFilters';
import { ExtensionsLogDataSource } from './dataSource';
import { createFilterTransformation } from './filterTransformation';
import { log } from './log';

const DATASOURCE_REF = {
  uid: nanoid(),
  type: 'grafana-extensionslog-datasource',
};

const logsViz = VizConfigBuilders.logs().setOption('wrapLogMessage', true).build();

sceneUtils.registerRuntimeDataSource({
  dataSource: new ExtensionsLogDataSource(DATASOURCE_REF.type, DATASOURCE_REF.uid, log),
});

export default function LogViewer(): ReactElement {
  return (
    <SceneContextProvider>
      <LogViewScene />
    </SceneContextProvider>
  );
}

function LogViewScene(): ReactElement | null {
  const [filter, setFilter] = useState<LogFilter>({});

  const data = useQueryRunner({
    datasource: DATASOURCE_REF,
    queries: [{ refId: 'A' }],
    liveStreaming: true,
  });

  const filteredData = useDataTransformer({
    transformations: [createFilterTransformation(filter)],
    data: data,
  });

  return (
    <Page
      navId="extensions"
      actions={<LogViewFilters provider={data} filteredProvider={filteredData} filter={filter} onChange={setFilter} />}
    >
      <AutoSizer>
        {({ height, width }) => (
          <VizGridLayout minHeight={height} minWidth={width}>
            <VizPanel title="" viz={logsViz} dataProvider={filteredData} />
          </VizGridLayout>
        )}
      </AutoSizer>
    </Page>
  );
}
