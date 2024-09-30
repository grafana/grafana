import { nanoid } from 'nanoid';
import { ReactElement, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { SceneQueryRunner, sceneUtils, VizConfigBuilders } from '@grafana/scenes';
import { SceneContextProvider, useQueryRunner, VizPanel } from '@grafana/scenes-react';
import { InlineField, InlineFieldRow, MultiSelect } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { VizGrid } from './VizGrid';
import { ExtensionsLogDataSource, LogDataQuery } from './dataSource';
import { log } from './log';

const DATASOURCE_REF = {
  uid: nanoid(),
  type: 'grafana-extensions-log',
};

const logsViz = VizConfigBuilders.logs().build();

const dataSource = new ExtensionsLogDataSource(DATASOURCE_REF.type, DATASOURCE_REF.uid, log);
sceneUtils.registerRuntimeDataSource({ dataSource });

export default function LogViewer(): ReactElement | null {
  return (
    <SceneContextProvider>
      <LogViewScene />
    </SceneContextProvider>
  );
}

function LogViewScene(): ReactElement | null {
  const [query, setQuery] = useState<LogDataQuery>({ refId: 'A' });

  const queryRunner = useQueryRunner({
    datasource: DATASOURCE_REF,
    queries: [query],
    maxDataPoints: 1000,
    liveStreaming: true,
  });

  return (
    <Page navId="extensions" actions={<LogFilters queryRunner={queryRunner} query={query} onChangeQuery={setQuery} />}>
      <SceneContextProvider>
        <VizGrid>
          <VizPanel title="Logs" viz={logsViz} dataProvider={queryRunner} />
        </VizGrid>
      </SceneContextProvider>
    </Page>
  );
}

interface LogFilterProps {
  queryRunner: SceneQueryRunner;
  query: LogDataQuery;
  onChangeQuery: (query: LogDataQuery) => void;
}

function LogFilters({ queryRunner, query, onChangeQuery }: LogFilterProps): ReactElement {
  const pluginIds = dataSource.getPluginIds().map((id) => ({ label: id, value: id }));
  const extensionPointIds = dataSource.getExtensionPointIds().map((id) => ({ label: id, value: id }));
  const levels = dataSource.getLevels().map((id) => ({ label: id, value: id }));

  // Added to get responsive UI with the selectable options when things changes in the data.
  queryRunner.useState();

  const onChangePluginIds = (values: Array<SelectableValue<string>>) => {
    onChangeQuery({ ...query, pluginIds: mapToSet(values) });
  };

  const onChangeExtensionPointIds = (values: Array<SelectableValue<string>>) => {
    onChangeQuery({ ...query, extensionPointIds: mapToSet(values) });
  };

  const onChangeLevels = (values: Array<SelectableValue<string>>) => {
    onChangeQuery({ ...query, levels: mapToSet(values) });
  };

  return (
    <InlineFieldRow>
      <InlineField label="Plugin Id">
        <MultiSelect options={pluginIds} onChange={onChangePluginIds} />
      </InlineField>
      <InlineField label="Extension">
        <MultiSelect options={extensionPointIds} onChange={onChangeExtensionPointIds} />
      </InlineField>
      <InlineField label="Levels">
        <MultiSelect options={levels} onChange={onChangeLevels} />
      </InlineField>
    </InlineFieldRow>
  );
}

function mapToSet(selected: Array<SelectableValue<string>>): Set<string> | undefined {
  if (selected.length <= 0) {
    return undefined;
  }

  return new Set<string>(selected.map((item) => item.value!));
}
