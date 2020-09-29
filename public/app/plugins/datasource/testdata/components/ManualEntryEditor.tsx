import React from 'react';
import { dateMath, dateTime } from '@grafana/data';
import { Form, InlineField, InlineFieldRow, Input, InputControl, Select } from '@grafana/ui';

export interface Props {
  onChange: any;
  query: any;
}

export const ManualEntryEditor = ({ onChange, query }: Partial<Props>) => {
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
