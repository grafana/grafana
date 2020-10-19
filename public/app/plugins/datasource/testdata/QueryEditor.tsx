// Libraries
import React, { ChangeEvent, FormEvent, useMemo, useEffect } from 'react';
import { useAsync } from 'react-use';

// Components
import { selectors as editorSelectors } from '@grafana/e2e-selectors';
import { Input, InlineFieldRow, InlineField, Select, TextArea, Switch } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { StreamingClientEditor, ManualEntryEditor, RandomWalkEditor } from './components';

// Types
import { TestDataDataSource } from './datasource';
import { TestDataQuery, Scenario } from './types';
import { PredictablePulseEditor } from './components/PredictablePulseEditor';
import { CSVWaveEditor } from './components/CSVWaveEditor';
import { defaultQuery } from './constants';
import { GrafanaLiveEditor } from './components/GrafanaLiveEditor';

const showLabelsFor = ['random_walk', 'predictable_pulse', 'predictable_csv_wave'];
const endpoints = [
  { value: 'datasources', label: 'Data Sources' },
  { value: 'search', label: 'Search' },
  { value: 'annotations', label: 'Annotations' },
];

// Fields that need to be transformed to numbers
const numberFields = ['lines', 'seriesCount', 'timeStep'];

const selectors = editorSelectors.components.DataSource.TestData.QueryTab;

export interface EditorProps {
  onChange: (value: any) => void;
  query: TestDataQuery;
}

export type Props = QueryEditorProps<TestDataDataSource, TestDataQuery>;

export const QueryEditor = ({ query, datasource, onChange, onRunQuery }: Props) => {
  query = { ...defaultQuery, ...query };

  const { loading, value: scenarioList } = useAsync<Scenario[]>(async () => {
    return datasource.getScenarios();
  }, []);

  const onUpdate = (query: TestDataQuery) => {
    onChange(query);
    onRunQuery();
  };

  useEffect(() => {
    onUpdate(query);
  }, []);

  const currentScenario = useMemo(() => scenarioList?.find(scenario => scenario.id === query.scenarioId), [
    scenarioList,
    query,
  ]);
  const scenarioId = currentScenario?.id;

  const onScenarioChange = (item: SelectableValue<string>) => {
    const scenario = scenarioList?.find(sc => sc.id === item.value);

    if (!scenario) {
      return;
    }

    const update = { ...query, scenarioId: item.value! };

    if (scenario.stringInput) {
      update.stringInput = scenario.stringInput;
    }

    if (scenario.id === 'grafana_api') {
      update.stringInput = 'datasources';
    } else if (scenario.id === 'streaming_client') {
      update.stringInput = '';
    } else if (scenario.id === 'live') {
      if (!update.channel) {
        update.channel = 'random-2s-stream'; // default stream
      }
    }

    onUpdate(update);
  };

  const onInputChange = (e: FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target as HTMLInputElement | HTMLTextAreaElement;
    let newValue: Partial<TestDataQuery> = { [name]: value };

    if (name === 'levelColumn') {
      newValue = { levelColumn: (e.target as HTMLInputElement).checked };
    } else if (numberFields.includes(name)) {
      newValue = { [name]: Number(value) };
    }

    onUpdate({ ...query, ...newValue });
  };

  const onFieldChange = (field: string) => (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target as HTMLInputElement;
    const formattedValue = numberFields.includes(name) ? Number(value) : value;
    onUpdate({ ...query, [field]: { ...query[field as keyof TestDataQuery], [name]: formattedValue } });
  };

  const onEndPointChange = ({ value }: SelectableValue) => {
    onUpdate({ ...query, stringInput: value });
  };

  const onStreamClientChange = onFieldChange('stream');
  const onPulseWaveChange = onFieldChange('pulseWave');
  const onCSVWaveChange = onFieldChange('csvWave');

  const options = useMemo(
    () =>
      (scenarioList || [])
        .map(item => ({ label: item.name, value: item.id }))
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
            options={options}
            value={options.find(item => item.value === query.scenarioId)}
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
                key="value", key2="value"
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

      {scenarioId === 'manual_entry' && <ManualEntryEditor onChange={onUpdate} query={query} onRunQuery={onRunQuery} />}
      {scenarioId === 'random_walk' && <RandomWalkEditor onChange={onInputChange} query={query} />}
      {scenarioId === 'streaming_client' && <StreamingClientEditor onChange={onStreamClientChange} query={query} />}
      {scenarioId === 'live' && <GrafanaLiveEditor onChange={onUpdate} query={query} />}
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
            <Switch onChange={onInputChange} name="levelColumn" value={!!query.levelColumn} />
          </InlineField>
        </InlineFieldRow>
      )}

      {scenarioId === 'grafana_api' && (
        <InlineField labelWidth={14} label="Endpoint">
          <Select
            options={endpoints}
            onChange={onEndPointChange}
            width={32}
            value={endpoints.find(ep => ep.value === query.stringInput)}
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
      {scenarioId === 'predictable_csv_wave' && <CSVWaveEditor onChange={onCSVWaveChange} query={query} />}
    </>
  );
};
