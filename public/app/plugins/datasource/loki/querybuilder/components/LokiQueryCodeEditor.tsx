import React from 'react';
import { testIds } from '../../components/LokiQueryEditor';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { LokiQueryEditorProps } from '../../components/types';
import { LokiQueryField } from '../../components/LokiQueryField';

export function LokiQueryCodeEditor({ query, datasource, range, onRunQuery, onChange, data }: LokiQueryEditorProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <LokiQueryField
        datasource={datasource}
        query={query}
        range={range}
        onRunQuery={onRunQuery}
        onChange={onChange}
        history={[]}
        data={data}
        data-testid={testIds.editor}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    // This wrapper styling can be removed after the old PromQueryEditor is removed.
    // This is removing margin bottom on the old legacy inline form styles
    wrapper: css`
      .gf-form {
        margin-bottom: 0;
      }
    `,
  };
};
