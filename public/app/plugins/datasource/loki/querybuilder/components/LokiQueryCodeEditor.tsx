import { Stack } from '@grafana/ui';

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
  return (
    <Stack direction="column" gap={0.5} maxWidth="100%">
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
      />
      {showExplain && <LokiQueryBuilderExplained query={query.expr} />}
    </Stack>
  );
}
