import React, { memo, FC } from 'react';
import { QueryEditorProps } from '@grafana/data';
import { PrometheusDatasource } from '../datasource';
import { PromQuery, PromOptions } from '../types';
import PromQueryField from './PromQueryField';
import { PromExploreExtraField } from './PromExploreExtraField';

export type Props = QueryEditorProps<PrometheusDatasource, PromQuery, PromOptions>;

export const PromExploreQueryEditor: FC<Props> = (props: Props) => {
  const { range, query, data, datasource, history, onChange, onRunQuery } = props;

  return (
    <PromQueryField
      datasource={datasource}
      query={query}
      range={range}
      onRunQuery={onRunQuery}
      onChange={onChange}
      onBlur={() => {}}
      history={history}
      data={data}
      ExtraFieldElement={
        <PromExploreExtraField query={query} onChange={onChange} datasource={datasource} onRunQuery={onRunQuery} />
      }
    />
  );
};

export default memo(PromExploreQueryEditor);
