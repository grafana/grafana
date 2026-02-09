import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { InlineLabel, useStyles2 } from '@grafana/ui';

import { ElasticsearchDataQuery } from '../../dataquery.gen';
import { useDispatch } from '../../hooks/useStatelessReducer';
import { QueryLanguage } from '../../types';

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
  onRunQuery: () => void;
}

export const CodeEditorSection = ({ value, onRunQuery }: Props) => {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);

  const currentQueryLanguage: QueryLanguage = value.queryLanguage === 'esql' ? 'esql' : 'raw_dsl';

  return (
    <>
      <div className={styles.root}>
        <InlineLabel width={17}>Query language</InlineLabel>
        <div>
          <QueryLanguageSelector
            value={currentQueryLanguage}
            onChange={(queryLanguage) => dispatch(changeQueryLanguage(queryLanguage))}
          />
        </div>
      </div>

      <RawQueryEditor
        value={currentQueryLanguage === 'raw_dsl' ? value.rawDSLQuery : value.esqlQuery}
        onChange={(query) =>
          dispatch(currentQueryLanguage === 'raw_dsl' ? changeRawDSLQuery(query) : changeEsqlQuery(query))
        }
        onRunQuery={onRunQuery}
      />
    </>
  );
};
