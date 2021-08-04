// Libraries
import React, { ChangeEvent, FormEvent, useMemo } from 'react';
import { useAsync } from 'react-use';

// Components
import { selectors as editorSelectors } from '@grafana/e2e-selectors';
import { Input, InlineFieldRow, InlineField, Select, TextArea, InlineSwitch } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { StreamingClientEditor, RandomWalkEditor } from './components';

// Types
import { TestDataDataSource } from './datasource';
import { TestDataQuery, Scenario, NodesQuery, CSVWave, USAQuery } from './types';
import { PredictablePulseEditor } from './components/PredictablePulseEditor';
import { CSVWavesEditor } from './components/CSVWaveEditor';
import { defaultCSVWaveQuery, defaultPulseQuery, defaultQuery } from './constants';
import { GrafanaLiveEditor } from './components/GrafanaLiveEditor';
import { NodeGraphEditor } from './components/NodeGraphEditor';
import { defaultStreamQuery } from './runStreams';
import { CSVFileEditor } from './components/CSVFileEditor';
import { CSVContentEditor } from './components/CSVContentEditor';
import { USAQueryEditor, usaQueryModes } from './components/USAQueryEditor';

const showLabelsFor = ['random_walk', 'predictable_pulse'];
const endpoints = [
  { value: 'datasources', label: 'Data Sources' },
  { value: 'search', label: 'Search' },
  { value: 'annotations', label: 'Annotations' },
];

const selectors = editorSelectors.components.DataSource.TestData.QueryTab;

export interface EditorProps {
  onChange: (value: any) => void;
  query: TestDataQuery;
}

export type Props = QueryEditorProps<TestDataDataSource, TestDataQuery>;

export const QueryEditor = ({ query, datasource, onChange, onRunQuery }: Props) => {
  query = { ...defaultQuery, ...query };

  const { loading, value: scenarioList } = useAsync<Scenario[]>(async () => {
    // migrate manual_entry (unusable since 7, removed in 8)
    if (query.scenarioId === 'manual_entry' && (query as any).points) {
      let csvContent = 'Time,Value\n';
      for (const point of (query as any).points) {
        csvContent += `${point[1]},${point[0]}\n`;
      }
      onChange({
        refId: query.refId,
        datasource: query.datasource,
        scenarioId: 'csv_content',
        csvContent,
      });
    }

    return datasource.getScenarios();
  }, []);

  const onUpdate = (query: TestDataQuery) => {
    onChange(query);
    onRunQuery();
  };

  const currentScenario = useMemo(() => scenarioList?.find((scenario) => scenario.id === query.scenarioId), [
    scenarioList,
    query,
  ]);
  const scenarioId = currentScenario?.id;

  const onScenarioChange = (item: SelectableValue<string>) => {
    const scenario = scenarioList?.find((sc) => sc.id === item.value);

    if (!scenario) {
      return;
    }

    // Clear model from existing props that belong to other scenarios
    const update: TestDataQuery = {
      scenarioId: item.value!,
      refId: query.refId,
      alias: query.alias,
    };

    if (scenario.stringInput) {
      update.stringInput = scenario.stringInput;
    }

    switch (scenario.id) {
      case 'grafana_api':
        update.stringInput = 'datasources';
        break;
      case 'streaming_client':
        update.stream = defaultStreamQuery;
        break;
      case 'live':
        update.channel = 'random-2s-stream'; // default stream
        break;
      case 'predictable_pulse':
        update.pulseWave = defaultPulseQuery;
        break;
      case 'predictable_csv_wave':
        update.csvWave = defaultCSVWaveQuery;
        break;
      case 'usa':
        update.usa = {
          mode: usaQueryModes[0].value,
        };
    }

    onUpdate(update);
  };

  const onInputChange = (e: FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement | HTMLTextAreaElement;
    let newValue: any = value;

    if (type === 'number') {
      newValue = Number(value);
    }

    if (name === 'levelColumn') {
      newValue = (e.target as HTMLInputElement).checked;
    }

    onUpdate({ ...query, [name]: newValue });
  };

  const onFieldChange = (field: string) => (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    let newValue: any = value;

    if (type === 'number') {
      newValue = Number(value);
    }

    onUpdate({ ...query, [field]: { ...(query as any)[field], [name]: newValue } });
  };

  const onEndPointChange = ({ value }: SelectableValue) => {
    onUpdate({ ...query, stringInput: value });
  };

  const onStreamClientChange = onFieldChange('stream');
  const onPulseWaveChange = onFieldChange('pulseWave');
  const onUSAStatsChange = (usa?: USAQuery) => {
    onUpdate({ ...query, usa });
  };

  const onCSVWaveChange = (csvWave?: CSVWave[]) => {
    onUpdate({ ...query, csvWave });
  };

  const options = useMemo(
    () =>
      (scenarioList || [])
        .map((item) => ({ label: item.name, value: item.id }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [scenarioList]
  );
  const showLabels = useMemo(() => showLabelsFor.includes(query.scenarioId), [query]);

  if (loading) {
    return null;
  }

  return (
    <>
      <InlineFieldRow aria-label={selectors.scenarioSelectContainer}>
        <InlineField labelWidth={14} label="Scenario">
          <Select
            menuShouldPortal
            options={options}
            value={options.find((item) => item.value === query.scenarioId)}
            onChange={onScenarioChange}
            width={32}
          />
        </InlineField>
        {currentScenario?.stringInput && (
          <InlineField label="String Input">
            <Input
              width={32}
              id={`stringInput-${query.refId}`}
              name="stringInput"
              placeholder={query.stringInput}
              value={query.stringInput}
              onChange={onInputChange}
            />
          </InlineField>
        )}
        <InlineField label="Alias" labelWidth={14}>
          <Input
            width={32}
            id={`alias-${query.refId}`}
            type="text"
            placeholder="optional"
            pattern='[^<>&\\"]+'
            name="alias"
            value={query.alias}
            onChange={onInputChange}
          />
        </InlineField>
        {showLabels && (
          <InlineField
            label="Labels"
            labelWidth={14}
            tooltip={
              <>
                Set labels using a key=value syntax:
                <br />
                {`{ key = "value", key2 = "value" }`}
                <br />
                key=&quot;value&quot;, key2=&quot;value&quot;
                <br />
                key=value, key2=value
                <br />
              </>
            }
          >
            <Input
              width={32}
              id={`labels-${query.refId}`}
              name="labels"
              onChange={onInputChange}
              value={query?.labels}
              placeholder="key=value, key2=value2"
            />
          </InlineField>
        )}
      </InlineFieldRow>

      {scenarioId === 'random_walk' && <RandomWalkEditor onChange={onInputChange} query={query} />}
      {scenarioId === 'streaming_client' && <StreamingClientEditor onChange={onStreamClientChange} query={query} />}
      {scenarioId === 'live' && <GrafanaLiveEditor onChange={onUpdate} query={query} />}
      {scenarioId === 'csv_file' && <CSVFileEditor onChange={onUpdate} query={query} />}
      {scenarioId === 'csv_content' && <CSVContentEditor onChange={onUpdate} query={query} />}
      {scenarioId === 'logs' && (
        <InlineFieldRow>
          <InlineField label="Lines" labelWidth={14}>
            <Input
              type="number"
              name="lines"
              value={query.lines}
              width={32}
              onChange={onInputChange}
              placeholder="10"
            />
          </InlineField>
          <InlineField label="Level" labelWidth={14}>
            <InlineSwitch onChange={onInputChange} name="levelColumn" value={!!query.levelColumn} />
          </InlineField>
        </InlineFieldRow>
      )}

      {scenarioId === 'usa' && <USAQueryEditor onChange={onUSAStatsChange} query={query.usa ?? {}} />}
      {scenarioId === 'grafana_api' && (
        <InlineField labelWidth={14} label="Endpoint">
          <Select
            menuShouldPortal
            options={endpoints}
            onChange={onEndPointChange}
            width={32}
            value={endpoints.find((ep) => ep.value === query.stringInput)}
          />
        </InlineField>
      )}

      {scenarioId === 'arrow' && (
        <InlineField grow>
          <TextArea
            name="stringInput"
            value={query.stringInput}
            rows={10}
            placeholder="Copy base64 text data from query result"
            onChange={onInputChange}
          />
        </InlineField>
      )}

      {scenarioId === 'predictable_pulse' && <PredictablePulseEditor onChange={onPulseWaveChange} query={query} />}
      {scenarioId === 'predictable_csv_wave' && <CSVWavesEditor onChange={onCSVWaveChange} waves={query.csvWave} />}
      {scenarioId === 'node_graph' && (
        <NodeGraphEditor onChange={(val: NodesQuery) => onChange({ ...query, nodes: val })} query={query} />
      )}
    </>
  );
};
