import React from 'react';
import { LegacyForms, RadioButtonGroup } from '@grafana/ui';
const { FormField } = LegacyForms;

type Props = {
  value: string;
  onChange: (value: string) => void;
};

const queryDirectionOptions = [
  { value: 'FORWARD', label: 'Forward', description: 'By default, run queries forward in time.' },
  { value: 'BACKWARD', label: 'Backward', description: 'By dfault, run queries backward in time.' },
];

export const DirectionField = (props: Props) => {
  const { value, onChange } = props;
  return (
    <FormField
      label="Direction"
      labelWidth={11}
      inputWidth={20}
      inputEl={<RadioButtonGroup options={queryDirectionOptions} value={value} onChange={onChange} />}
      tooltip={
        <>
          Loki queries can be made in either 'FORWARD' or 'BACKWARD' directions. This configuration is the default for
          the data source but can be changed on a per-query basis. 'FORWARD' queries are processed in chronological
          order. 'BACKWARD' queries are processed in reverse chronological order.
        </>
      }
    />
  );
};
