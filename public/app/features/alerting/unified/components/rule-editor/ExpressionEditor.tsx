import { TextArea } from '@grafana/ui';
import React, { FC } from 'react';

interface Props {
  value?: string;
  onChange: (value: string) => void;
  dataSourceName: string; // will be a prometheus or loki datasource
}

// @TODO implement proper prom/loki query editor here
export const ExpressionEditor: FC<Props> = ({ value, onChange, dataSourceName }) => {
  return (
    <TextArea
      placeholder="Enter a promql expression"
      value={value}
      onChange={(evt) => onChange((evt.target as HTMLTextAreaElement).value)}
    />
  );
};
