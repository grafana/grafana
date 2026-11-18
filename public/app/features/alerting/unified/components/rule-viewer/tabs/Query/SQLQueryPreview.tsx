import { t } from '@grafana/i18n';
import { CodeMirrorEditor } from '@grafana/ui/unstable';
import { type AlertDataQuery } from 'app/types/unified-alerting-dto';

interface Props {
  expression: string;
}

export const SQLQueryPreview = ({ expression }: Props) => (
  <CodeMirrorEditor
    value={expression}
    onChange={() => {}}
    language="sql"
    height="80px"
    readOnly
    basicSetup={{ lineNumbers: false, foldGutter: false }}
    aria-label={t('alerting.sql-query-preview.aria-label', 'SQL query preview')}
  />
);

export interface SQLLike {
  refId: string;
  rawSql: string;
}

export function isSQLLikeQuery(model: AlertDataQuery): model is SQLLike {
  return 'rawSql' in model;
}
