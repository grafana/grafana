import { css } from '@emotion/css';
import { defaults } from 'lodash';
import React, { useState } from 'react';

import { QueryEditorProps } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { TempoDatasource, TempoQuery } from '../datasource';
import { defaultQuery, MyDataSourceOptions } from '../types';

import { TempoQueryBuilderOptions } from './TempoQueryBuilderOptions';
import { TraceQLEditor } from './TraceQLEditor';

type Props = QueryEditorProps<TempoDatasource, TempoQuery, MyDataSourceOptions>;

export function QueryEditor(props: Props) {
  const [query, setQuery] = useState(defaults(props.query, defaultQuery));
  const styles = useStyles2(getStyles);

  const onLimitChange = (e: React.FormEvent<HTMLInputElement>) => {
    setQuery({ ...query, limit: parseInt(e.currentTarget.value, 10) });
  };

  const onEditorChange = (value: string) => {
    props.onChange({ ...query, query: value });
  };

  return (
    <>
      <TraceQLEditor value={query.query} onChange={onEditorChange} datasource={props.datasource} />
      <div className={styles.optionsContainer}>
        <TempoQueryBuilderOptions query={query} onLimitChange={onLimitChange} />
      </div>
    </>
  );
}

const getStyles = () => ({
  optionsContainer: css`
    margin-top: 10px;
  `,
});
