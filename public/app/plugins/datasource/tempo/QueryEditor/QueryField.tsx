import { css } from '@emotion/css';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  Badge,
  FileDropzone,
  InlineField,
  InlineFieldRow,
  InlineLabel,
  QueryField,
  RadioButtonGroup,
  Themeable2,
  withTheme2,
} from '@grafana/ui';
import { TraceToLogsOptions } from 'app/core/components/TraceToLogsSettings';
import React from 'react';
import { LokiQueryField } from '../../loki/components/LokiQueryField';
import { LokiQuery } from '../../loki/types';
import { TempoDatasource, TempoQuery, TempoQueryType } from '../datasource';
import LokiDatasource from '../../loki/datasource';
import { PrometheusDatasource } from '../../prometheus/datasource';
import useAsync from 'react-use/lib/useAsync';
import NativeSearch from './NativeSearch';
import { getDS } from './utils';
import { ServiceGraphSection } from './ServiceGraphSection';

interface Props extends QueryEditorProps<TempoDatasource, TempoQuery>, Themeable2 {}

const DEFAULT_QUERY_TYPE: TempoQueryType = 'traceId';

interface State {
  linkedDatasourceUid?: string;
  linkedDatasource?: LokiDatasource;
  serviceMapDatasourceUid?: string;
  serviceMapDatasource?: PrometheusDatasource;
}

class TempoQueryFieldComponent extends React.PureComponent<Props, State> {
  state = {
    linkedDatasourceUid: undefined,
    linkedDatasource: undefined,
    serviceMapDatasourceUid: undefined,
    serviceMapDatasource: undefined,
  };

  constructor(props: Props) {
    super(props);
  }

  async componentDidMount() {
    const { datasource } = this.props;
    // Find query field from linked datasource
    const tracesToLogsOptions: TraceToLogsOptions = datasource.tracesToLogs || {};
    const linkedDatasourceUid = tracesToLogsOptions.datasourceUid;

    const serviceMapDsUid = datasource.serviceMap?.datasourceUid;

    // Check status of linked data sources so we can show warnings if needed.
    const [logsDs, serviceMapDs] = await Promise.all([getDS(linkedDatasourceUid), getDS(serviceMapDsUid)]);

    this.setState({
      linkedDatasourceUid: linkedDatasourceUid,
      linkedDatasource: logsDs as LokiDatasource,
      serviceMapDatasourceUid: serviceMapDsUid,
      serviceMapDatasource: serviceMapDs as PrometheusDatasource,
    });

    // Set initial query type to ensure traceID field appears
    if (!this.props.query.queryType) {
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

  render() {
    const { query, onChange, datasource } = this.props;
    // Find query field from linked datasource
    const tracesToLogsOptions: TraceToLogsOptions = datasource.tracesToLogs || {};
    const logsDatasourceUid = tracesToLogsOptions.datasourceUid;
    const graphDatasourceUid = datasource.serviceMap?.datasourceUid;

    const queryTypeOptions: Array<SelectableValue<TempoQueryType>> = [
      { value: 'traceId', label: 'TraceID' },
      { value: 'upload', label: 'JSON file' },
    ];

    if (config.featureToggles.tempoServiceGraph) {
      queryTypeOptions.push({ value: 'serviceMap', label: 'Service Graph' });
    }

    if (config.featureToggles.tempoSearch && !datasource?.search?.hide) {
      queryTypeOptions.unshift({ value: 'nativeSearch', label: 'Search - Beta' });
    }

    if (logsDatasourceUid && tracesToLogsOptions?.lokiSearch !== false) {
      if (!config.featureToggles.tempoSearch) {
        // Place at beginning as Search if no native search
        queryTypeOptions.unshift({ value: 'search', label: 'Search' });
      } else {
        // Place at end as Loki Search if native search is enabled
        queryTypeOptions.push({ value: 'search', label: 'Loki Search' });
      }
    }

    return (
      <>
        <InlineFieldRow>
          <InlineField label="Query type">
            <RadioButtonGroup<TempoQueryType>
              options={queryTypeOptions}
              value={query.queryType}
              onChange={(v) =>
                onChange({
                  ...query,
                  queryType: v,
                })
              }
              size="md"
            />
          </InlineField>
        </InlineFieldRow>
        {query.queryType === 'nativeSearch' && (
          <p style={{ maxWidth: '65ch' }}>
            <Badge icon="rocket" text="Beta" color="blue" />
            {config.featureToggles.tempoBackendSearch ? (
              <>&nbsp;Tempo search is currently in beta.</>
            ) : (
              <>
                &nbsp;Tempo search is currently in beta and is designed to return recent traces only. It ignores the
                time range picker. We are actively working on full backend search. Look for improvements in the near
                future!
              </>
            )}
          </p>
        )}
        {query.queryType === 'search' && (
          <SearchSection
            linkedDatasourceUid={logsDatasourceUid}
            query={query}
            onRunQuery={this.onRunLinkedQuery}
            onChange={this.onChangeLinkedQuery}
          />
        )}
        {query.queryType === 'nativeSearch' && (
          <NativeSearch
            datasource={this.props.datasource}
            query={query}
            onChange={onChange}
            onBlur={this.props.onBlur}
            onRunQuery={this.props.onRunQuery}
          />
        )}
        {query.queryType === 'upload' && (
          <div className={css({ padding: this.props.theme.spacing(2) })}>
            <FileDropzone
              options={{ multiple: false }}
              onLoad={(result) => {
                this.props.datasource.uploadedJson = result;
                this.props.onRunQuery();
              }}
            />
          </div>
        )}
        {query.queryType === 'traceId' && (
          <InlineFieldRow>
            <InlineField label="Trace ID" labelWidth={14} grow>
              <QueryField
                query={query.query}
                onChange={(val) => {
                  onChange({
                    ...query,
                    query: val,
                    queryType: 'traceId',
                    linkedQuery: undefined,
                  });
                }}
                onBlur={this.props.onBlur}
                onRunQuery={this.props.onRunQuery}
                placeholder={'Enter a Trace ID (run with Shift+Enter)'}
                portalOrigin="tempo"
              />
            </InlineField>
          </InlineFieldRow>
        )}
        {query.queryType === 'serviceMap' && (
          <ServiceGraphSection graphDatasourceUid={graphDatasourceUid} query={query} onChange={onChange} />
        )}
      </>
    );
  }
}

interface SearchSectionProps {
  linkedDatasourceUid?: string;
  onChange: (value: LokiQuery) => void;
  onRunQuery: () => void;
  query: TempoQuery;
}
function SearchSection({ linkedDatasourceUid, onChange, onRunQuery, query }: SearchSectionProps) {
  const dsState = useAsync(() => getDS(linkedDatasourceUid), [linkedDatasourceUid]);
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
          query={query.linkedQuery ?? ({ refId: 'linked' } as any)}
          history={[]}
        />
      </>
    );
  }

  if (!linkedDatasourceUid) {
    return <div className="text-warning">Please set up a Traces-to-logs datasource in the datasource settings.</div>;
  }

  if (linkedDatasourceUid && !ds) {
    return (
      <div className="text-warning">
        Traces-to-logs datasource is configured but the data source no longer exists. Please configure existing data
        source to use the search.
      </div>
    );
  }

  return null;
}

export const TempoQueryField = withTheme2(TempoQueryFieldComponent);
