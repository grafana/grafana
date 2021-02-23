import { InlineField, InlineSwitch } from '@grafana/ui';
import React from 'react';
import { PromQuery } from '../types';

interface Props {
  query: PromQuery;
  onChange: (value: PromQuery) => void;
}

const onExemplarsChange = ({ query, onChange }: Props) => (e: React.ChangeEvent<HTMLInputElement>) => {
  const exemplar = e.target.checked;
  onChange({ ...query, exemplar });
};

export function PromExemplarField(props: Props) {
  return (
    <InlineField label="Exemplars" labelWidth="auto">
      <InlineSwitch label="Exemplars" value={!!props.query.exemplar} onChange={onExemplarsChange(props)} />
    </InlineField>
  );
}
