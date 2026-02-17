// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/PromQueryCodeEditor.tsx
import { selectors } from '@grafana/e2e-selectors';
import { Stack } from '@grafana/ui';

import { PromQueryField } from '../../components/PromQueryField';
import { PromQueryEditorProps } from '../../components/types';

import { PromQueryBuilderExplained } from './PromQueryBuilderExplained';

type PromQueryCodeEditorProps = PromQueryEditorProps & {
  showExplain: boolean;
};

export function PromQueryCodeEditor(props: PromQueryCodeEditorProps) {
  const { query, datasource, range, onRunQuery, onChange, data, app, showExplain } = props;

  return (
    <Stack
      data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.queryField}
      direction="column"
      gap={0.5}
      maxWidth="100%"
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
    </Stack>
  );
}
