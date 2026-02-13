import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { InlineLabel, useStyles2 } from '@grafana/ui';

import { ElasticsearchDataQuery } from '../../dataquery.gen';
import { useDispatch } from '../../hooks/useStatelessReducer';
import { QueryLanguage } from '../../types';

import { useDatasource } from './ElasticsearchQueryContext';
import { QueryLanguageSelector } from './QueryLanguageSelector';
import { RawQueryEditor } from './RawQueryEditor';
import { changeEsqlQuery, changeQueryLanguage, changeRawDSLQuery } from './state';

const getStyles = (theme: GrafanaTheme2) => ({
  root: css({
    display: 'flex',
  }),
});

interface Props {
  value: ElasticsearchDataQuery;
  queryLanguage: QueryLanguage;
  showQueryLanguageSelector: boolean;
  onRunQuery: () => void;
}

export const CodeEditorSection = ({ value, queryLanguage, showQueryLanguageSelector, onRunQuery }: Props) => {
  const dispatch = useDispatch();
  const datasource = useDatasource();
  const styles = useStyles2(getStyles);

  const editorLanguage = queryLanguage === 'esql' ? 'sql' : 'json';

  return (
    <>
      {showQueryLanguageSelector && (
        <div className={styles.root}>
          <InlineLabel width={17}>Query language</InlineLabel>
          <div>
            <QueryLanguageSelector
              value={queryLanguage}
              onChange={(nextLanguage) => dispatch(changeQueryLanguage(nextLanguage))}
            />
          </div>
        </div>
      )}

      <RawQueryEditor
        value={queryLanguage === 'raw_dsl' ? value.rawDSLQuery : value.esqlQuery}
        language={editorLanguage}
        onChange={(query) => dispatch(queryLanguage === 'raw_dsl' ? changeRawDSLQuery(query) : changeEsqlQuery(query))}
        onFocusPopulate={(currentValue) => {
          const index = datasource.index?.trim();
          // Only prefill ES|QL queries when a datasource index is configured and the editor is empty.
          if (queryLanguage !== 'esql' || !index || currentValue.trim()) {
            return undefined;
          }

          // Return boilerplate text for editor-local population on focus; this avoids dispatching and triggering a query run.
          return 'FROM $index ';
        }}
        onRunQuery={onRunQuery}
      />
    </>
  );
};
