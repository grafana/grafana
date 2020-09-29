// Libraries
import React, { useMemo } from 'react';
import { useAsync } from 'react-use';

// Components
import { Input, InlineFieldRow, InlineField, Select } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { StreamingClientEditor, ManualEntryEditor, RandomWalkEditor } from './components';

// Types
import { TestDataDataSource } from './datasource';
import { TestDataQuery, Scenario } from './types';

const showLabelsFor = ['random_walk', 'predictable_pulse', 'predictable_csv_wave'];
const endpoints = [
  { value: 'datasources', label: 'Data Sources' },
  { value: 'search', label: 'Search' },
  { value: 'annotations', label: 'Annotations' },
];

type Props = QueryEditorProps<TestDataDataSource, TestDataQuery>;

export const QueryEditor = ({ query, datasource, onChange }: Props) => {
  const { loading, error, value: scenarioList } = useAsync<Scenario[]>(async () => {
    return datasource.getScenarios();
  }, []);

  const currentScenario = useMemo(
    () => scenarioList?.find(scenario => scenario.id === (query.scenarioId || 'random_walk')),
    [scenarioList, query]
  );

  query.stringInput = (query.stringInput || currentScenario?.stringInput) ?? '';
  const onScenarioChange = (item: SelectableValue<string>) => {
    onChange({
      ...query,
      stringInput: currentScenario?.stringInput ?? '',
      scenarioId: item.value!,
    });
  };

  const onInputChange = (e: any) => {
    const { name, value } = e.target;
    onChange({ ...query, [name]: value });
  };

  const onEndPointChange = ({ value }: SelectableValue) => {
    onChange({ ...query, stringInput: value });
  };

  const onStreamClientChange = (e: any) => {
    const { name, value } = e.target;
    if (name !== 'lines') {
      onChange({ ...query, stream: { ...query.stream, [name]: value } });
    } else {
      onChange({ ...query, [name]: value });
    }
  };

  const options = useMemo(() => (scenarioList || []).map(item => ({ label: item.name, value: item.id })), [
    scenarioList,
  ]);
  const showLabels = useMemo(() => showLabelsFor.includes(query.scenarioId), [query]);

  if (loading) {
    return null;
  }

  const scenarioId = currentScenario?.id;
  return (
    <>
      <InlineFieldRow>
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
              id="stringInput"
              name="stringInput"
              placeholder={query.stringInput}
              value={query.stringInput}
              onChange={onInputChange}
            />
          </InlineField>
        )}
        <InlineField label="Alias">
          <Input
            id="alias"
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
              id="labels"
              name="labels"
              onChange={onInputChange}
              value={query?.labels}
              placeholder="key=value, key2=value2"
            />
          </InlineField>
        )}
      </InlineFieldRow>

      {scenarioId === 'manual_entry' && <ManualEntryEditor onChange={onChange} query={query} />}
      {scenarioId === 'random_walk' && <RandomWalkEditor onChange={onInputChange} query={query} />}
      {scenarioId === 'streaming_client' && <StreamingClientEditor onChange={onStreamClientChange} query={query} />}
      {scenarioId === 'grafana_api' && (
        <InlineField labelWidth={14} label="Endpoint">
          <Select options={endpoints} onChange={onEndPointChange} />
        </InlineField>
      )}
      {/*TODO check arrow scenario*/}
    </>
  );
};
