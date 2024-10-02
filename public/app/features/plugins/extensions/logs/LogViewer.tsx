import { isEmpty } from 'lodash';
import { nanoid } from 'nanoid';
import { ReactElement, useState } from 'react';

import { DataTransformerConfig, MatcherConfig, ValueMatcherID } from '@grafana/data';
import { sceneUtils, VizConfigBuilders } from '@grafana/scenes';
import { SceneContextProvider, useDataTransformer, useQueryRunner, VizPanel } from '@grafana/scenes-react';
import { Page } from 'app/core/components/Page/Page';

import { LogFilter, LogViewFilters } from './LogViewFilters';
import { VizGrid } from './VizGrid';
import { ExtensionsLogDataSource } from './dataSource';
import { log } from './log';

const DATASOURCE_REF = {
  uid: nanoid(),
  type: 'grafana-extensions-log',
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
    <Page navId="extensions" actions={<LogViewFilters queryRunner={data} filter={filter} onChange={setFilter} />}>
      <VizGrid>
        <VizPanel title="Logs" viz={logsViz} dataProvider={filteredData} />
      </VizGrid>
    </Page>
  );
}

function mapToTransformations(filter: LogFilter): DataTransformerConfig[] {
  if (isEmpty(filter.extensionPointIds) && isEmpty(filter.levels) && isEmpty(filter.pluginIds)) {
    return [];
  }

  const filters: Array<{ fieldName: string; config: MatcherConfig }> = [];

  if (!isEmpty(filter.extensionPointIds)) {
    const extensionPointsFilters = Array.from(filter.extensionPointIds!).map((value) => ({
      fieldName: 'extensionPointId',
      config: { id: ValueMatcherID.equal, options: { value } },
    }));
    filters.push.apply(filters, extensionPointsFilters);
  }

  if (!isEmpty(filter.pluginIds)) {
    const pluginFilters = Array.from(filter.pluginIds!).map((value) => ({
      fieldName: 'pluginId',
      config: { id: ValueMatcherID.equal, options: { value } },
    }));
    filters.push.apply(filters, pluginFilters);
  }

  if (!isEmpty(filter.levels)) {
    const levelFilters = Array.from(filter.levels!).map((value) => ({
      fieldName: 'severity',
      config: { id: ValueMatcherID.equal, options: { value } },
    }));
    filters.push.apply(filters, levelFilters);
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
