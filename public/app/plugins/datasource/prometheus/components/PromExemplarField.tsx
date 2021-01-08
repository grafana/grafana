import { InlineField, Switch, useStyles } from '@grafana/ui';
import React from 'react';
import { getExemplarsSettingsStyles } from '../configuration/ExemplarsSettings';
import { PromQuery } from '../types';

interface Props {
  query: PromQuery;
  onChange: (value: PromQuery) => void;
}

const onExemplarsChange = ({ query, onChange }: Props) => (e: React.ChangeEvent<HTMLInputElement>) => {
  const exemplar = e.target.checked;
  onChange({ ...query, exemplar: exemplar });
};

export function PromExemplarField(props: Props) {
  const styles = useStyles(getExemplarsSettingsStyles);

  return (
    <InlineField label="Exemplars" labelWidth="auto">
      <div className={styles.switch}>
        <Switch label="Exemplars" value={props.query.exemplar} onChange={onExemplarsChange(props)} />
      </div>
    </InlineField>
  );
}
