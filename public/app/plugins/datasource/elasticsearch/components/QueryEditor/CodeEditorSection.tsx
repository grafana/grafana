import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { InlineLabel, useStyles2 } from '@grafana/ui';

import { ElasticsearchDataQuery, QueryType } from '../../dataquery.gen';
import { useDispatch } from '../../hooks/useStatelessReducer';

import { useDatasource } from './ElasticsearchQueryContext';
import { EsqlQueryEditor } from './EsqlQueryEditor';
import { QueryLanguageSelector } from './QueryLanguageSelector';
import { RawQueryEditor } from './RawQueryEditor';
import { changeQuery, changeQueryType } from './state';

const getStyles = (theme: GrafanaTheme2) => ({
  root: css({
    display: 'flex',
  }),
});

interface Props {
  value: ElasticsearchDataQuery;
  queryType: QueryType;
  showQueryLanguageSelector: boolean;
  onRunQuery: () => void;
  onFormatReady?: (formatFn: () => void) => void;
}

export const CodeEditorSection = ({
  value,
  queryType,
  showQueryLanguageSelector,
  onRunQuery,
  onFormatReady,
}: Props) => {
  const dispatch = useDispatch();
  const datasource = useDatasource();
  const styles = useStyles2(getStyles);

  const editorProps = useMemo(
    () => ({
      value: value.query,
      onChange: (query: string) => dispatch(changeQuery(query)),
      onFocusPopulate: (currentValue: string) => {
        const index = datasource.index?.trim();
        // Only prefill ES|QL queries when a datasource index is configured and the editor is empty.
        if (queryType !== 'esql' || !index || currentValue.trim()) {
          return undefined;
        }

        // Return boilerplate text for editor-local population on focus; this avoids dispatching and triggering a query run.
        return 'FROM $__index ';
      },
      onRunQuery,
      onFormatReady,
    }),
    [value, queryType, dispatch, datasource, onRunQuery, onFormatReady]
  );

  return (
    <>
      {showQueryLanguageSelector && (
        <div className={styles.root}>
          <InlineLabel width={17}>Query language</InlineLabel>
          <div>
            <QueryLanguageSelector
              value={queryType}
              onChange={(nextLanguage) => dispatch(changeQueryType(nextLanguage))}
            />
          </div>
        </div>
      )}

      {queryType === 'esql' ? (
        <EsqlQueryEditor {...editorProps} />
      ) : (
        <RawQueryEditor {...editorProps} language="json" />
      )}
    </>
  );
};
