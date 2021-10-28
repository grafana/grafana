import React from 'react';
import { AlertingPageWrapper } from '../AlertingPageWrapper';
import { Field, Input, Label } from '@grafana/ui';

interface Props {}

const NewMuteTiming = (props: Props) => {
  return (
    <AlertingPageWrapper pageId="am-routes">
      <form>
        <Field required label="Name" description="A unique name for the mute timing">
          <Input />
        </Field>
        <Field label="Time range" description="The time inclusive of the starting time and exclusive of the end time">
          <>
            <Label>Start time</Label>
            <Input placeholder="HH:MM" />
            <Label>End time</Label>
            <Input placeholder="HH:MM" />
          </>
        </Field>
        <Field label="Days of the week">
          <Input placeholder="Ex: monday, tuesday:thursday" />
        </Field>
        <Field
          label="Days of the month"
          description="The days of the month, 1-31, of a month. Negative values can be used to represent days which begin at the end of the month"
        >
          <Input placeholder="Ex: 1, 14:16, -1" />
        </Field>
        <Field label="Months" description="The months of the year in either numerical or the full calendar month">
          <Input placeholder="Ex: 1:3, may:august, december" />
        </Field>
        <Field label="Years">
          <Input placeholder="Ex: 2021:2022, 2030" />
        </Field>
      </form>
    </AlertingPageWrapper>
  );
};

export default NewMuteTiming;
