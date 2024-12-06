import { memo, useCallback, useEffect, useState } from 'react';
import { useEffectOnce } from 'react-use';

import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { InlineSelect } from '@grafana/experimental';

import { CloudWatchDatasource } from '../../../datasource';
import { DEFAULT_CWLI_QUERY_STRING, DEFAULT_PPL_QUERY_STRING, DEFAULT_SQL_QUERY_STRING } from '../../../defaultQueries';
import { CloudWatchJsonData, CloudWatchLogsQuery, CloudWatchQuery, LogsQueryLanguage } from '../../../types';

import { CloudWatchLink } from './CloudWatchLink';
import { CloudWatchLogsQueryField } from './LogsQueryField';

type Props = QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData> & {
  query: CloudWatchLogsQuery;
  extraHeaderElementLeft?: React.Dispatch<JSX.Element | undefined>;
};

const logsQueryLanguageOptions: Array<SelectableValue<LogsQueryLanguage>> = [
  { label: 'Logs Insights QL', value: LogsQueryLanguage.CWLI },
  { label: 'OpenSearch SQL', value: LogsQueryLanguage.SQL },
  { label: 'OpenSearch PPL', value: LogsQueryLanguage.PPL },
];

export const CloudWatchLogsQueryEditor = memo(function CloudWatchLogsQueryEditor(props: Props) {
  const { query, data, datasource, onChange, extraHeaderElementLeft } = props;

  const [isQueryNew, setIsQueryNew] = useState(true);

  const onQueryLanguageChange = useCallback(
    (language: LogsQueryLanguage | undefined) => {
      if (isQueryNew) {
        onChange({
          ...query,
          expression: getDefaultQueryString(language),
          queryLanguage: language ?? LogsQueryLanguage.CWLI,
        });
      } else {
        onChange({ ...query, queryLanguage: language ?? LogsQueryLanguage.CWLI });
      }
    },
    [isQueryNew, onChange, query]
  );

  // if the query has already been saved from before, we shouldn't replace it with a default one
  useEffectOnce(() => {
    if (query.expression) {
      setIsQueryNew(false);
    }
  });

  useEffect(() => {
    // if it's a new query, we should replace it with a default one
    if (isQueryNew && !query.expression) {
      onChange({ ...query, expression: getDefaultQueryString(query.queryLanguage) });
    }
  }, [onChange, query, isQueryNew]);

  useEffect(() => {
    extraHeaderElementLeft?.(
      <InlineSelect
        label="Query language"
        value={query.queryLanguage || LogsQueryLanguage.CWLI}
        options={logsQueryLanguageOptions}
        onChange={({ value }) => {
          onQueryLanguageChange(value);
        }}
      />
    );

    return () => {
      extraHeaderElementLeft?.(undefined);
    };
  }, [extraHeaderElementLeft, onChange, onQueryLanguageChange, query]);

  const onQueryStringChange = (query: CloudWatchQuery) => {
    onChange(query);
    setIsQueryNew(false);
  };

  return (
    <CloudWatchLogsQueryField
      {...props}
      onChange={onQueryStringChange}
      ExtraFieldElement={<CloudWatchLink query={query} panelData={data} datasource={datasource} />}
    />
  );
});

export default CloudWatchLogsQueryEditor;

const getDefaultQueryString = (language: LogsQueryLanguage | undefined) => {
  switch (language) {
    case LogsQueryLanguage.SQL:
      return DEFAULT_SQL_QUERY_STRING;
    case LogsQueryLanguage.PPL:
      return DEFAULT_PPL_QUERY_STRING;
    case LogsQueryLanguage.CWLI:
    default:
      return DEFAULT_CWLI_QUERY_STRING;
  }
};
