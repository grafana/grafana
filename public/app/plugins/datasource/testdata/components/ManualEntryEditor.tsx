import React from 'react';
import { dateMath, dateTime, SelectableValue } from '@grafana/data';
import { Form, InlineField, InlineFieldRow, Input, InputControl, Select } from '@grafana/ui';
import { EditorProps } from '../QueryEditor';
import { NewPoint, PointValue } from '../types';

interface Props extends EditorProps {
  onRunQuery: () => void;
}

export const ManualEntryEditor = ({ onChange, query, onRunQuery }: Props) => {
  console.log('q', query);
  const addPoint = (point: NewPoint) => {
    console.log('p', point);
    let points = query.points || [[]];
    const newPointTime = dateMath.parse(point.newPointTime);
    points = [...points, [Number(point.newPointValue), newPointTime!.valueOf()]].sort((a, b) => a[1] - b[1]);
    onChange({ ...query, points });
    console.log('points', points);
    onRunQuery();
  };

  const deletePoint = (point: SelectableValue) => {
    query.points = query.points.filter((p: PointValue[]) => p[0] !== point.value);
  };

  const points = (query.points || []).map((point, index) => {
    return {
      label: dateTime(point[1]).format('MMMM Do YYYY, H:mm:ss') + ' : ' + point[0],
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
              <Input
                width={32}
                type="number"
                placeholder="value"
                id="newPointValue"
                name="newPointValue"
                ref={register}
              />
            </InlineField>
            <InlineField label="Time" labelWidth={14}>
              <Input
                width={32}
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
                width={32}
                name="selectedPoint"
                onChange={value => value[0]}
              />
            </InlineField>

            {selectedPoint && (
              <InlineField>
                <button type="button" className="btn btn-danger gf-form-btn" onClick={() => deletePoint(selectedPoint)}>
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
