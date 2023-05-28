import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { testIds } from '../../components/LokiQueryEditor';
import { LokiQueryField } from '../../components/LokiQueryField';
import { getStats } from '../../components/stats';
import { LokiQueryEditorProps } from '../../components/types';
import { QueryStats } from '../../types';

import { LokiQueryBuilderExplained } from './LokiQueryBuilderExplained';

type Props = LokiQueryEditorProps & {
  showExplain: boolean;
  setQueryStats: React.Dispatch<React.SetStateAction<QueryStats | null>>;
};

export function LokiQueryCodeEditor({
  query,
  datasource,
  range,
  onRunQuery,
  onChange,
  data,
  app,
  showExplain,
  history,
  setQueryStats,
}: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <LokiQueryField
        datasource={datasource}
        query={query}
        range={range}
        onRunQuery={onRunQuery}
        onChange={onChange}
        history={history}
        data={data}
        app={app}
        data-testid={testIds.editor}
        onQueryType={async (query: string) => {
          const stats = await getStats(datasource, query);
          setQueryStats(stats);
        }}
      />
      {showExplain && <LokiQueryBuilderExplained query={query.expr} />}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      max-width: 100%;
      .gf-form {
        margin-bottom: 0.5;
      }
    `,
  };
};
