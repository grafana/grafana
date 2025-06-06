// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/PromQueryCodeEditor.tsx
import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useStyles2 } from '@grafana/ui';

import { PromQueryField } from '../../components/PromQueryField';
import { PromQueryEditorProps } from '../../components/types';

import { PromQueryBuilderExplained } from './PromQueryBuilderExplained';

type PromQueryCodeEditorProps = PromQueryEditorProps & {
  showExplain: boolean;
};

export function PromQueryCodeEditor(props: PromQueryCodeEditorProps) {
  const { query, datasource, range, onRunQuery, onChange, data, app, showExplain } = props;
  const styles = useStyles2(getStyles);

  return (
    <div
      data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.queryField}
      className={styles.wrapper}
    >
      <PromQueryField
        datasource={datasource}
        query={query}
        range={range}
        onRunQuery={onRunQuery}
        onChange={onChange}
        history={[]}
        data={data}
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
    wrapper: css({
      '.gf-form': {
        marginBottom: 0,
      },
    }),
  };
};
