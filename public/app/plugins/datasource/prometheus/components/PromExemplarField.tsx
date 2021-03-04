import { FetchError } from '@grafana/runtime';
import { InlineField, InlineSwitch } from '@grafana/ui';
import React, { useEffect, useRef, useState } from 'react';
import { PrometheusDatasource } from '../datasource';
import { PromQuery } from '../types';

interface Props {
  query: PromQuery;
  onChange: (value: PromQuery) => void;
  datasource: PrometheusDatasource;
}

const onExemplarsChange = ({ query, onChange }: Props) => (e: React.ChangeEvent<HTMLInputElement>) => {
  const exemplar = e.target.checked;
  onChange({ ...query, exemplar });
};

export function PromExemplarField(props: Props) {
  const [error, setError] = useState<FetchError>();
  const switchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (switchRef.current) {
      switchRef.current.disabled = !!error;
    }
  }, [error]);

  useEffect(() => {
    const subscription = props.datasource.exemplarErrors.subscribe((err) => {
      setError(err);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [props]);

  return (
    <InlineField
      label="Show exemplars"
      labelWidth="auto"
      tooltip={error ? 'Exemplars are not supported in this version of Prometheus.' : undefined}
    >
      <InlineSwitch value={!!props.query.exemplar} onChange={onExemplarsChange(props)} ref={switchRef} />
    </InlineField>
  );
}
