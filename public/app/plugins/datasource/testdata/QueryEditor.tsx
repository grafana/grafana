// Libraries
import React, { useMemo } from 'react';
import { useAsync } from 'react-use';

// Components
import { Field, Form, Icon, InlineFormLabel, Input, LegacyForms, Select, Tooltip } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';

// Types
import { TestDataDataSource } from './datasource';
import { TestDataQuery, Scenario } from './types';

const showLabelsFor = ['random_walk', 'predictable_pulse', 'predictable_csv_wave'];

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

  const options = useMemo(() => (scenarioList || []).map(item => ({ label: item.name, value: item.id })), [
    scenarioList,
  ]);
  const showLabels = useMemo(() => showLabelsFor.includes(query.scenarioId), [query]);

  if (loading) {
    return null;
  }

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
        <Input
          type="text"
          placeholder="optional"
          pattern='[^<>&\\"]+'
          name="alias"
          value={query.alias}
          onChange={onInputChange}
        />
      </div>
      <div className="gf-form gf-form--grow">
        {showLabels ? (
          <>
            <InlineFormLabel className="query-keyword" width={7}>
              Labels
              <Tooltip
                placement="top"
                content={
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
                theme={'info'}
              >
                <div className="gf-form-help-icon gf-form-help-icon--right-normal">
                  <Icon name="info-circle" size="sm" />
                </div>
              </Tooltip>
            </InlineFormLabel>
            <Input name="labels" onChange={onInputChange} value={query.labels} placeholder="key=value, key2=value2" />
          </>
        ) : (
          <div className="gf-form-label gf-form-label--grow" />
        )}
      </div>
    </div>
  );
};
