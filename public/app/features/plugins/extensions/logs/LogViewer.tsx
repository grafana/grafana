import { isEmpty } from 'lodash';
import { nanoid } from 'nanoid';
import { ReactElement, useState } from 'react';

import { DataTransformerConfig } from '@grafana/data';
import { sceneUtils, VizConfigBuilders } from '@grafana/scenes';
import { SceneContextProvider, useDataTransformer, useQueryRunner, VizPanel } from '@grafana/scenes-react';
import { Page } from 'app/core/components/Page/Page';

import { FilterConfig, LogFilter, LogViewFilters } from './LogViewFilters';
import { VizGrid } from './VizGrid';
import { ExtensionsLogDataSource } from './dataSource';
import { log } from './log';

const DATASOURCE_REF = {
  uid: nanoid(),
  type: 'grafana-extensionslog-datasource',
};

const logsViz = VizConfigBuilders.logs().build();

sceneUtils.registerRuntimeDataSource({
  dataSource: new ExtensionsLogDataSource(DATASOURCE_REF.type, DATASOURCE_REF.uid, log),
});

export default function LogViewer(): ReactElement | null {
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
    maxDataPoints: 1000,
    liveStreaming: true,
  });

  const filteredData = useDataTransformer({
    transformations: mapToTransformations(filter),
    data: data,
  });

  return (
    <Page
      navId="extensions"
      actions={<LogViewFilters provider={data} filteredProvider={filteredData} filter={filter} onChange={setFilter} />}
    >
      <VizGrid>
        <VizPanel title="Logs" viz={logsViz} dataProvider={filteredData} />
      </VizGrid>
    </Page>
  );
}

function mapToTransformations(filter: LogFilter): DataTransformerConfig[] {
  if (isEmpty(filter.extensionPointIds) && isEmpty(filter.severity) && isEmpty(filter.pluginIds)) {
    return [];
  }

  const filters: FilterConfig[] = [];

  if (filter.extensionPointIds && !isEmpty(filter.extensionPointIds)) {
    filters.push.apply(filters, filter.extensionPointIds);
  }

  if (filter.pluginIds && !isEmpty(filter.pluginIds)) {
    filters.push.apply(filters, filter.pluginIds);
  }

  if (filter.severity && !isEmpty(filter.severity)) {
    filters.push.apply(filters, filter.severity);
  }

  return [
    {
      id: 'filterByValue',
      options: {
        filters: filters,
        match: 'all',
      },
    },
  ];
}
