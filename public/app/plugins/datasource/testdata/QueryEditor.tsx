// Libraries
import React, { useMemo } from 'react';
import { useAsync } from 'react-use';

// Components
import { Form, Input, InputControl, InlineFieldRow, InlineField, Select } from '@grafana/ui';
import { dateMath, dateTime, QueryEditorProps, SelectableValue } from '@grafana/data';

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

  const options = useMemo(() => (scenarioList || []).map(item => ({ label: item.name, value: item.id })), [
    scenarioList,
  ]);
  const showLabels = useMemo(() => showLabelsFor.includes(query.scenarioId), [query]);

  if (loading) {
    return null;
  }

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

      {currentScenario.id === 'manual_entry' && <ManualEntryEditor onChange={onChange} query={query} />}
      {currentScenario.id === 'random_walk' && <RandomWalkEditor onChange={onInputChange} query={query} />}
    </>
  );
};

const ManualEntryEditor = ({ onChange, query }: Partial<Props>) => {
  const addPoint = point => {
    let points = query.points || [];
    const newPointTime = dateMath.parse(point.newPointTime);
    points = [...points, [point.newPointValue, newPointTime.valueOf()]].sort((a, b) => a[1] - b[1]);
    console.log('p', point, points);
  };

  const deletePoint = () => {};

  const points = (query.points || []).map((point, index) => {
    return {
      text: dateTime(point[1]).format('MMMM Do YYYY, H:mm:ss') + ' : ' + point[0],
      value: index,
    };
  });

  return (
    <Form onSubmit={addPoint} maxWidth="none">
      {({ register, control, watch }) => {
        const selectedPoint = watch('selectedPoint');
        return (
          <InlineFieldRow>
            <InlineField label="New value" labelWidth={14}>
              <Input type="number" placeholder="value" id="newPointValue" name="newPointValue" ref={register} />
            </InlineField>
            <InlineField label="Time">
              <Input
                id="newPointTime"
                placeholder="time"
                name="newPointTime"
                ref={register}
                defaultValue={dateTime().format()}
              />
            </InlineField>
            <button className="btn btn-secondary gf-form-btn">Add</button>
            <InlineField label="All values">
              <InputControl
                control={control}
                as={Select}
                options={points}
                width={16}
                name="selectedPoint"
                onChange={value => {
                  console.log('v', value);
                  return value;
                }}
              />
            </InlineField>

            {selectedPoint?.value && (
              <InlineField>
                <button type="button" className="btn btn-danger gf-form-btn" onClick={deletePoint}>
                  Delete
                </button>
              </InlineField>
            )}
          </InlineFieldRow>
        );
      }}
    </Form>
  );
};

const randomWalkFields = [
  { label: 'Series count', id: 'seriesCount', placeholder: '1', min: 1, step: 1 },
  { label: 'Start value', id: 'startValue', placeholder: 'auto', step: 1 },
  { label: 'Spread', id: 'spread', placeholder: '1', min: 0.5, step: 0.1 },
  { label: 'Noise', id: 'noise', placeholder: '0', min: 0, step: 0.1 },
  { label: 'Min', id: 'min', placeholder: 'none', step: 0.1 },
  { label: 'Max', id: 'max', placeholder: 'none', step: 0.1 },
];

const RandomWalkEditor = ({ onChange, query }: Partial<Props>) => {
  return (
    <InlineFieldRow>
      {randomWalkFields.map(({ label, id, min, step, placeholder }) => {
        return (
          <InlineField label={label} labelWidth={14} key={id}>
            <Input
              width={32}
              type="number"
              id={id}
              min={min}
              step={step}
              value={query?.[id]}
              placeholder={placeholder}
              onChange={onChange}
            />
          </InlineField>
        );
      })}
    </InlineFieldRow>
  );
};
