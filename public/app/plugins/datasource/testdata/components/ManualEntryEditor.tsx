import React from 'react';
import { dateMath, dateTime, SelectableValue } from '@grafana/data';
import { Form, InlineField, InlineFieldRow, Input, InputControl, Select, Button } from '@grafana/ui';
import { EditorProps } from '../QueryEditor';
import { NewPoint } from '../types';

export interface Props extends EditorProps {
  onRunQuery: () => void;
}

export const ManualEntryEditor = ({ onChange, query, onRunQuery }: Props) => {
  const points = query.points ?? [];

  const addPoint = (point: NewPoint) => {
    const newPointTime = dateMath.parse(point.newPointTime);
    const pointsUpdated = [...points, [Number(point.newPointValue), newPointTime!.valueOf()]].sort(
      (a, b) => a[1] - b[1]
    );
    onChange({ ...query, points: pointsUpdated });
    onRunQuery();
  };

  const deletePoint = (point: SelectableValue) => {
    const pointsUpdated = points.filter((_, index) => index !== point.value);
    onChange({ ...query, points: pointsUpdated });
    onRunQuery();
  };

  const pointOptions = points.map((point, index) => {
    return {
      label: dateTime(point[1]).format('MMMM Do YYYY, H:mm:ss') + ' : ' + point[0],
      value: index,
    };
  });

  return (
    <Form onSubmit={addPoint} maxWidth="none">
      {({ register, control, watch, setValue }) => {
        const selectedPoint = watch('selectedPoint' as any) as SelectableValue;
        return (
          <InlineFieldRow>
            <InlineField label="New value" labelWidth={14}>
              <Input
                {...register('newPointValue')}
                width={32}
                type="number"
                placeholder="value"
                id={`newPointValue-${query.refId}`}
              />
            </InlineField>
            <InlineField label="Time" labelWidth={14}>
              <Input
                {...register('newPointTime')}
                width={32}
                id={`newPointTime-${query.refId}`}
                placeholder="time"
                defaultValue={dateTime().format()}
              />
            </InlineField>
            <InlineField>
              <Button variant="secondary">Add</Button>
            </InlineField>
            <InlineField label="All values">
              <InputControl
                name={'selectedPoint' as any}
                control={control}
                render={({ field: { ref, ...field } }) => (
                  <Select {...field} options={pointOptions} width={32} placeholder="Select point" />
                )}
              />
            </InlineField>

            {selectedPoint?.value !== undefined && (
              <InlineField>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setValue('selectedPoint' as any, [{ value: undefined, label: 'Select value' }]);
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
