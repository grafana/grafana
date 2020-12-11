import { LegacyForms } from '@grafana/ui';
import React from 'react';
import { PromQuery } from '../types';

interface Props {
  query: PromQuery;
  onChange: (value: PromQuery) => void;
}

const { Switch } = LegacyForms;

const onExemplarsChange = ({ query, onChange }: Props) => (e: React.ChangeEvent<HTMLInputElement>) => {
  const exemplar = e.target.checked;
  onChange({ ...query, exemplar: exemplar });
};

export function PromExemplarField(props: Props) {
  return (
    <div className="gf-form">
      <Switch label="Exemplars" checked={Boolean(props.query.exemplar)} onChange={onExemplarsChange(props)} />
    </div>
  );
}
