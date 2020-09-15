// Libraries
import React, { useMemo } from 'react';
import { useAsync } from 'react-use';

// Components
import { Field, Form, InlineFormLabel, Input, LegacyForms, Select } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';

// Types
import { TestDataDataSource } from './datasource';
import { TestDataQuery, Scenario } from './types';

type Props = QueryEditorProps<TestDataDataSource, TestDataQuery>;

export const QueryEditor = ({ query, datasource, onChange }: Props) => {
  const { loading, error, value: scenarioList } = useAsync<Scenario[]>(async () => {
    return datasource.getScenarios();
  }, []);

  const currentScenario = useMemo(
    () => scenarioList?.find(scenario => scenario.id === (query.scenarioId || 'random_walk')),
    [scenarioList, query]
  );

  query.stringInput = query.stringInput || currentScenario?.stringInput;
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

  if (loading) {
    return null;
  }

  const options = scenarioList.map(item => ({ label: item.name, value: item.id }));

  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <InlineFormLabel className="query-keyword" width={7}>
          Scenario
        </InlineFormLabel>
        <Select
          options={options}
          value={options.find(item => item.value === query.scenarioId)}
          onChange={onScenarioChange}
          width={32}
        />
      </div>
      {currentScenario?.stringInput && (
        <div className="gf-form">
          <InlineFormLabel className="query-keyword" width={7}>
            String Input
          </InlineFormLabel>
          <Input
            name="stringInput"
            placeholder={query.stringInput}
            value={query.stringInput}
            onChange={onInputChange}
          />
        </div>
      )}
      <div className="gf-form">
        <InlineFormLabel className="query-keyword" width={7}>
          Alias
        </InlineFormLabel>
        <Input type="text" placeholder="optional" pattern='[^<>&\\"]+' name="alias" onChange={onInputChange} />
      </div>
    </div>
  );
};
