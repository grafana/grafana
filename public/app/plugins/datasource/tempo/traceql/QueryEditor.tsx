import { css } from '@emotion/css';
import { defaults } from 'lodash';
import React from 'react';

import { QueryEditorProps } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { TempoDatasource } from '../datasource';
import { defaultQuery, MyDataSourceOptions, TempoQuery } from '../types';

import { TempoQueryBuilderOptions } from './TempoQueryBuilderOptions';
import { TraceQLEditor } from './TraceQLEditor';

type Props = QueryEditorProps<TempoDatasource, TempoQuery, MyDataSourceOptions>;

export function QueryEditor(props: Props) {
  const styles = useStyles2(getStyles);
  const query = defaults(props.query, defaultQuery);

  const onEditorChange = (value: string) => {
    props.onChange({ ...query, query: value });
  };

  return (
    <>
      <TraceQLEditor value={query.query} onChange={onEditorChange} datasource={props.datasource} />
      <div className={styles.optionsContainer}>
        <TempoQueryBuilderOptions query={query} onChange={props.onChange} />
      </div>
    </>
  );
}

const getStyles = () => ({
  optionsContainer: css`
    margin-top: 10px;
  `,
});
