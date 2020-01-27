import React, { memo, useState, useEffect } from 'react';

// Types
import { ExploreQueryFieldProps } from '@grafana/data';

import { PrometheusDatasource } from '../datasource';
import { PromQuery, PromOptions } from '../types';

import PromQueryField from './PromQueryField';
import { PromExploreExtraField } from './PromExploreExtraField';

export type Props = ExploreQueryFieldProps<PrometheusDatasource, PromQuery, PromOptions>;

export const PromExploreQueryEditor = memo(function PromExploreQueryEditor(props: Props) {
  const { query, data, datasource, history, onChange, onRunQuery } = props;
  const [step, setStep] = useState(query.interval);

  function onChangeQueryStep(value: string, override?: boolean) {
    const { query, onChange, onRunQuery } = props;
    if (onChange) {
      const nextQuery = { ...query, interval: value };
      onChange(nextQuery);
      if (override && onRunQuery) {
        onRunQuery();
      }
    }
  }

  function onStepChange(e: React.SyntheticEvent<HTMLInputElement>) {
    setStep(e.currentTarget.value);
  }

  function onReturnKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      onRunQuery();
    }
  }

  useEffect(() => {
    onChangeQueryStep(step);
  }, [step]);

  return (
    <div className="gf-form-inline">
      <PromQueryField
        datasource={datasource}
        query={query}
        onRunQuery={onRunQuery}
        onChange={onChange}
        history={history}
        data={data}
        ExtraFieldElement={
          <PromExploreExtraField
            label={'Step'}
            onChangeFunc={onStepChange}
            onKeyDownFunc={onReturnKeyDown}
            value={step}
          />
        }
      />
    </div>
  );
});

export default PromExploreQueryEditor;
