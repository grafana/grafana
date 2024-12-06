import { css } from '@emotion/css';
import { ReactNode, useCallback } from 'react';

import { GrafanaTheme2, QueryEditorProps } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { CloudWatchDatasource } from '../../../datasource';
import { CloudWatchJsonData, CloudWatchLogsQuery, CloudWatchQuery, LogsQueryLanguage } from '../../../types';
import { LogGroupsFieldWrapper } from '../../shared/LogGroups/LogGroupsField';

import { LogsQLCodeEditor } from './code-editors/LogsQLCodeEditor';
import { PPLQueryEditor } from './code-editors/PPLQueryEditor';
import { SQLQueryEditor } from './code-editors/SQLCodeEditor';

export interface CloudWatchLogsQueryFieldProps
  extends QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData> {
  ExtraFieldElement?: ReactNode;
  query: CloudWatchLogsQuery;
}
export const CloudWatchLogsQueryField = (props: CloudWatchLogsQueryFieldProps) => {
  const { query, datasource, onChange, ExtraFieldElement } = props;

  const styles = useStyles2(getStyles);

  const onChangeLogs = useCallback(
    async (query: CloudWatchLogsQuery) => {
      onChange(query);
    },
    [onChange]
  );

  return (
    <>
      <LogGroupsFieldWrapper
        region={query.region}
        datasource={datasource}
        legacyLogGroupNames={query.logGroupNames}
        logGroups={query.logGroups}
        onChange={(logGroups) => {
          onChangeLogs({ ...query, logGroups, logGroupNames: undefined });
        }}
        //legacy props
        legacyOnChange={(logGroupNames) => {
          onChangeLogs({ ...query, logGroupNames });
        }}
      />
      <div>
        {getCodeEditor(query, datasource, onChange)}
        <div className={styles.editor}>{ExtraFieldElement}</div>
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  editor: css({
    marginTop: theme.spacing(1),
  }),
});

const getCodeEditor = (
  query: CloudWatchLogsQuery,
  datasource: CloudWatchDatasource,
  onChange: (value: CloudWatchLogsQuery) => void
) => {
  switch (query.queryLanguage) {
    case LogsQueryLanguage.PPL:
      return <PPLQueryEditor query={query} datasource={datasource} onChange={onChange} />;
    case LogsQueryLanguage.SQL:
      return <SQLQueryEditor query={query} datasource={datasource} onChange={onChange} />;
    default:
      return <LogsQLCodeEditor query={query} datasource={datasource} onChange={onChange} />;
  }
};
