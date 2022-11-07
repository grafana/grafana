import { css } from '@emotion/css';
import React from 'react';

import { CoreApp, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { testIds } from '../../components/LokiQueryEditor';
import { LokiQueryField } from '../../components/LokiQueryField';
import { LokiQueryEditorProps } from '../../components/types';

import { LokiQueryBuilderExplained } from './LokiQueryBuilderExplained';

type Props = LokiQueryEditorProps & {
  showExplain: boolean;
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
}: Props) {
  const styles = useStyles2(getStyles);

  // the inner QueryField works like this when a blur event happens:
  // - if it has an onBlur prop, it calls it
  // - else it calls onRunQuery (some extra conditions apply)
  //
  // we want it to not do anything when a blur event happens in explore mode,
  // so we set an empty-function in such case. otherwise we set `undefined`,
  // which will cause it to run the query when blur happens.
  const onBlur = app === CoreApp.Explore ? () => undefined : undefined;

  return (
    <div className={styles.wrapper}>
      <LokiQueryField
        datasource={datasource}
        query={query}
        range={range}
        onRunQuery={onRunQuery}
        onChange={onChange}
        onBlur={onBlur}
        history={history}
        data={data}
        app={app}
        data-testid={testIds.editor}
      />
      {showExplain && <LokiQueryBuilderExplained query={query.expr} />}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      .gf-form {
        margin-bottom: 0.5;
      }
    `,
  };
};
