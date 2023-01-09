import { css } from '@emotion/css';
import React from 'react';
import useAsync from 'react-use/lib/useAsync';

import { GrafanaTheme2, QueryEditorProps, SelectableValue } from '@grafana/data';
import { EditorHeader, EditorRow, EditorRows, FlexItem, Stack } from '@grafana/experimental';
import { reportInteraction } from '@grafana/runtime';
import {
  Button,
  FileDropzone,
  InlineField,
  InlineFieldRow,
  InlineLabel,
  RadioButtonGroup,
  Themeable2,
  withTheme2,
} from '@grafana/ui';

import { LokiQueryField } from '../../loki/components/LokiQueryField';
import { LokiDatasource } from '../../loki/datasource';
import { LokiQuery } from '../../loki/types';
import { QueryOptionGroup } from '../../prometheus/querybuilder/shared/QueryOptionGroup';
import { TempoDatasource } from '../datasource';
import { QueryEditor } from '../traceql/QueryEditor';
import { TempoQueryBuilderOptions } from '../traceql/TempoQueryBuilderOptions';
import { TempoQuery, TempoQueryType } from '../types';

import NativeSearch from './NativeSearch';
import { ServiceGraphSection } from './ServiceGraphSection';
import { getDS } from './utils';

interface Props extends QueryEditorProps<TempoDatasource, TempoQuery>, Themeable2 {}
interface State {
  searchType: string;
}

const DEFAULT_QUERY_TYPE: TempoQueryType = 'traceql';

class TempoQueryFieldComponent extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      searchType: 'traceQL',
    };
  }

  // Set the default query type when the component mounts.
  // Also do this if queryType is 'clear' (which is the case when the user changes the query type)
  // otherwise if the user changes the query type and refreshes the page, no query type will be selected
  // which is inconsistent with how the UI was originally when they selected the Tempo data source.
  async componentDidMount() {
    if (!this.props.query.queryType || this.props.query.queryType === 'clear') {
      this.props.onChange({
        ...this.props.query,
        queryType: DEFAULT_QUERY_TYPE,
      });
    }
  }

  onChangeLinkedQuery = (value: LokiQuery) => {
    const { query, onChange } = this.props;
    onChange({
      ...query,
      linkedQuery: { ...value, refId: 'linked' },
    });
  };

  onRunLinkedQuery = () => {
    this.props.onRunQuery();
  };

  onClearResults = () => {
    // Run clear query to clear results
    const { onChange, query, onRunQuery } = this.props;
    onChange({
      ...query,
      queryType: 'clear',
    });
    onRunQuery();
  };

  render() {
    const { query, onChange, datasource, theme } = this.props;
    const styles = getStyles(theme);

    const logsDatasourceUid = datasource.getLokiSearchDS();

    const graphDatasourceUid = datasource.serviceMap?.datasourceUid;

    let queryTypeOptions: Array<SelectableValue<TempoQueryType>> = [
      { value: 'traceql', label: 'TraceQL' },
      { value: 'upload', label: 'JSON File' },
      { value: 'serviceMap', label: 'Service Graph' },
    ];

    if (!datasource?.search?.hide) {
      queryTypeOptions.unshift({ value: 'nativeSearch', label: 'Search' });
    }

    if (logsDatasourceUid) {
      if (datasource?.search?.hide) {
        // Place at beginning as Search if no native search
        queryTypeOptions.unshift({ value: 'search', label: 'Search' });
      } else {
        // Place at end as Loki Search if native search is enabled
        queryTypeOptions.push({ value: 'search', label: 'Loki Search' });
      }
    }

    return (
      <>
        <EditorHeader>
          <Stack gap={1}>
            <label htmlFor={'tempo-query-type-radio-group'} className={styles.switchLabel}>
              Query type
            </label>
            <RadioButtonGroup<TempoQueryType>
              id={'tempo-query-type-radio-group'}
              options={[
                { value: 'traces', label: 'Traces' },
                { value: 'serviceMap', label: 'Service Graph' },
              ]}
              size="sm"
              value={query.queryType}
              onChange={(v) => {
                onChange({
                  ...query,
                  queryType: v,
                });
              }}
            />
          </Stack>
          <FlexItem grow={1} />

          {query.queryType === 'traces' && (
            <RadioButtonGroup
              options={[
                { value: 'traceQL', label: 'TraceQL' },
                { value: 'uiSearch', label: 'UI Search' },
              ]}
              size="sm"
              value={this.state.searchType}
              onChange={(v) => {
                this.setState({ searchType: v });
              }}
            />
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              /* open modal*/
            }}
          >
            Import trace
          </Button>
        </EditorHeader>

        <EditorRows>
          {query.queryType === 'traces' && this.state.searchType === 'traceQL' && (
            <>
              <EditorRow>
                <QueryEditor
                  datasource={this.props.datasource}
                  query={query}
                  onRunQuery={this.props.onRunQuery}
                  onChange={onChange}
                />
              </EditorRow>
              {/*<EditorRow>*/}
              {/*  <QueryOptionGroup title="UI search" collapsedInfo={[]}>*/}
              {/*    <NativeSearch*/}
              {/*      datasource={this.props.datasource}*/}
              {/*      query={query}*/}
              {/*      onChange={onChange}*/}
              {/*      onBlur={this.props.onBlur}*/}
              {/*      onRunQuery={this.props.onRunQuery}*/}
              {/*    />*/}
              {/*  </QueryOptionGroup>*/}
              {/*</EditorRow>*/}
              <TempoQueryBuilderOptions query={query} onChange={onChange} />
            </>
          )}

          {query.queryType === 'traces' && this.state.searchType === 'uiSearch' && (
            <>
              <EditorRow>
                <NativeSearch
                  datasource={this.props.datasource}
                  query={query}
                  onChange={onChange}
                  onBlur={this.props.onBlur}
                  onRunQuery={this.props.onRunQuery}
                />
              </EditorRow>
              <TempoQueryBuilderOptions query={query} onChange={onChange} />
            </>
          )}

          {query.queryType === 'serviceMap' && (
            <EditorRow>
              <ServiceGraphSection graphDatasourceUid={graphDatasourceUid} query={query} onChange={onChange} />
            </EditorRow>
          )}
        </EditorRows>

        {/*{query.queryType === 'upload' && (*/}
        {/*  <div className={css({ padding: this.props.theme.spacing(2) })}>*/}
        {/*    <FileDropzone*/}
        {/*      options={{ multiple: false }}*/}
        {/*      onLoad={(result) => {*/}
        {/*        this.props.datasource.uploadedJson = result;*/}
        {/*        this.props.onRunQuery();*/}
        {/*      }}*/}
        {/*    />*/}
        {/*  </div>*/}
        {/*)}*/}
      </>
    );
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    switchLabel: css({
      color: theme.colors.text.secondary,
      cursor: 'pointer',
      fontSize: theme.typography.bodySmall.fontSize,
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
  };
};

interface SearchSectionProps {
  logsDatasourceUid?: string;
  onChange: (value: LokiQuery) => void;
  onRunQuery: () => void;
  query: TempoQuery;
}
function SearchSection({ logsDatasourceUid, onChange, onRunQuery, query }: SearchSectionProps) {
  const dsState = useAsync(() => getDS(logsDatasourceUid), [logsDatasourceUid]);
  if (dsState.loading) {
    return null;
  }

  const ds = dsState.value as LokiDatasource;

  if (ds) {
    return (
      <>
        <InlineLabel>Tempo uses {ds.name} to find traces.</InlineLabel>
        <LokiQueryField
          datasource={ds}
          onChange={onChange}
          onRunQuery={onRunQuery}
          query={query.linkedQuery ?? ({ refId: 'linked' } as LokiQuery)}
          history={[]}
        />
      </>
    );
  }

  if (!logsDatasourceUid) {
    return <div className="text-warning">Please set up a Loki search datasource in the datasource settings.</div>;
  }

  if (logsDatasourceUid && !ds) {
    return (
      <div className="text-warning">
        Loki search datasource is configured but the data source no longer exists. Please configure existing data source
        to use the search.
      </div>
    );
  }

  return null;
}

export const TempoQueryField = withTheme2(TempoQueryFieldComponent);
