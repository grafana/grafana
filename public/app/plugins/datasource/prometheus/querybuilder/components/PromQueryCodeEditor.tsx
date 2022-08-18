import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { testIds } from '../../components/PromQueryEditor';
import PromQueryField from '../../components/PromQueryField';
import { PromQueryEditorProps } from '../../components/types';

import { PromQueryBuilderExplained } from './PromQueryBuilderExplained';

type Props = PromQueryEditorProps & {
  showExplain: boolean;
};

export function PromQueryCodeEditor(props: Props) {
  const { query, datasource, range, onRunQuery, onChange, data, app, showExplain } = props;
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

      {showExplain && <PromQueryBuilderExplained query={query.expr} />}
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
