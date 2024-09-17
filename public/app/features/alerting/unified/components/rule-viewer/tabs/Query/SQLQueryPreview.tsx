import { ReactMonacoEditor } from '@grafana/ui';
import { AlertDataQuery } from 'app/types/unified-alerting-dto';

interface Props {
  expression: string;
}

export const SQLQueryPreview = ({ expression }: Props) => (
  <ReactMonacoEditor
    options={{
      readOnly: true,
      minimap: {
        enabled: false,
      },
      scrollBeyondLastColumn: 0,
      scrollBeyondLastLine: false,
      lineNumbers: 'off',
      cursorWidth: 0,
      overviewRulerLanes: 0,
    }}
    defaultLanguage="sql"
    height={80}
    defaultValue={expression}
    width="100%"
  />
);

export interface SQLLike {
  refId: string;
  rawSql: string;
}

export function isSQLLikeQuery(model: AlertDataQuery): model is SQLLike {
  return 'rawSql' in model;
}

export default SQLQueryPreview;
