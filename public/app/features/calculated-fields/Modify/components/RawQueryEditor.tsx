import { css } from '@emotion/css';
import { FC, useState, useEffect, useCallback } from 'react';

import {
  Field,
  CodeEditor,
  CodeEditorSuggestionItem,
  CodeEditorSuggestionItemKind,
  Button,
  useTheme2,
} from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

interface Props {
  query: string;
  columns: string[];
  onQueryChange: (sqlQuery: string) => void;
  queryValidated?: boolean;
  validateRawQuery: () => void;
  formName?: string;
}
export const RawQueryEditor: FC<Props> = ({
  query,
  columns,
  onQueryChange,
  queryValidated,
  validateRawQuery,
  formName,
}) => {
  const theme = useTheme2();
  const [colSuggestions, setColSuggestions] = useState<CodeEditorSuggestionItem[]>([]);
  useEffect(() => {
    const colOptions: CodeEditorSuggestionItem[] = [];
    columns.map((item: string) => {
      colOptions.push({ label: item, kind: CodeEditorSuggestionItemKind.Field, insertText: `"${formName}"."${item}"` });
    });
    setColSuggestions(colOptions);
  }, [columns, formName]);

  const getSuggestions = useCallback(() => {
    return colSuggestions;
  }, [colSuggestions]);
  return (
    <Field label="SQL" required={true}>
      <div
        className={css`
          display: flex;
          align-items: start;
          flex-direction: column;
        `}
      >
        <div
          className={css`
            display: block;
            width: 100%;
          `}
        >
          <CodeEditor
            language="sql"
            value={query}
            onBlur={onQueryChange}
            height={150}
            getSuggestions={getSuggestions}
            showLineNumbers
          />
        </div>
        <div
          className={css`
            display: flex;
            width: 100%;
            font-size: ${theme.typography.size.xs};
            flex-direction: column;
          `}
        >
          <span>{t('bmc.calc-fields.query-info', 'Query must be a single column query')}</span>
          <span>{t('bmc.calc-fields.eg', 'Eg') + ': COUNT("HPD:Help Desk"."Incident Number")'}</span>
        </div>
        <Button
          style={{ marginTop: '10px' }}
          size="sm"
          variant="primary"
          fill="solid"
          icon={queryValidated === undefined ? 'fa fa-spinner' : undefined}
          onClick={validateRawQuery}
        >
          <Trans i18nKey="bmc.calc-fields.validate">Validate</Trans>
        </Button>
      </div>
    </Field>
  );
};
