import React from 'react';
import { dateMath, dateTime, SelectableValue } from '@grafana/data';
import { Form, InlineField, InlineFieldRow, Input, InputControl, Select, Button } from '@grafana/ui';
import { EditorProps } from '../QueryEditor';
import { NewPoint } from '../types';

export interface Props extends EditorProps {
  onRunQuery: () => void;
}

export const ManualEntryEditor = ({ onChange, query, onRunQuery }: Props) => {
  const addPoint = (point: NewPoint) => {
    const newPointTime = dateMath.parse(point.newPointTime);
    const points = [...query.points, [Number(point.newPointValue), newPointTime!.valueOf()]].sort(
      (a, b) => a[1] - b[1]
    );
    onChange({ ...query, points });
    onRunQuery();
  };

  const deletePoint = (point: SelectableValue) => {
    const points = query.points.filter((_, index) => index !== point.value);
    onChange({ ...query, points });
    onRunQuery();
  };

  const points = query.points.map((point, index) => {
    return {
      label: dateTime(point[1]).format('MMMM Do YYYY, H:mm:ss') + ' : ' + point[0],
      value: index,
    };
  });

  return (
    <Form onSubmit={addPoint} maxWidth="none">
      {({ register, control, watch }) => {
        const selectedPoint = watch('selectedPoint') as SelectableValue;
        return (
          <InlineFieldRow>
            <InlineField label="New value" labelWidth={14}>
              <Input
                width={32}
                type="number"
                placeholder="value"
                id={`newPointValue-${query.refId}`}
                name="newPointValue"
                ref={register}
              />
            </InlineField>
            <InlineField label="Time" labelWidth={14}>
              <Input
                width={32}
                id={`newPointTime-${query.refId}`}
                placeholder="time"
                name="newPointTime"
                ref={register}
                defaultValue={dateTime().format()}
              />
            </InlineField>
            <InlineField>
              <Button variant="secondary">Add</Button>
            </InlineField>
            <InlineField label="All values">
              <InputControl
                control={control}
                as={Select}
                options={points}
                width={32}
                name="selectedPoint"
                onChange={value => value[0]}
                placeholder="Select point"
              />
            </InlineField>

            {selectedPoint?.value !== undefined && (
              <InlineField>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    control.setValue('selectedPoint', [{ value: undefined, label: 'Select value' }]);
                    deletePoint(selectedPoint);
                  }}
                >
                  Delete
                </Button>
              </InlineField>
            )}
          </InlineFieldRow>
        );
      }}
    </Form>
  );
};
