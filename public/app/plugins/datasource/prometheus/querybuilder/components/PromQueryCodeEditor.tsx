import React from 'react';
import { PromQueryEditorProps } from '../../components/types';
import PromQueryField from '../../components/PromQueryField';
import { testIds } from '../../components/PromQueryEditor';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

export function PromQueryCodeEditor({
  query,
  datasource,
  range,
  onRunQuery,
  onChange,
  data,
  app,
}: PromQueryEditorProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <PromQueryField
        datasource={datasource}
        query={query}
        range={range}
        onRunQuery={onRunQuery}
        onChange={onChange}
        history={[]}
        data={data}
        data-testid={testIds.editor}
        app={app}
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
