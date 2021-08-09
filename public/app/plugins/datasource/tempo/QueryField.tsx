import { css } from '@emotion/css';
import { DataSourceApi, ExploreQueryFieldProps, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, getDataSourceSrv } from '@grafana/runtime';
import {
  FileDropzone,
  InlineField,
  InlineFieldRow,
  InlineLabel,
  LegacyForms,
  RadioButtonGroup,
  Themeable2,
  withTheme2,
} from '@grafana/ui';
import { TraceToLogsOptions } from 'app/core/components/TraceToLogsSettings';
import React from 'react';
import { LokiQueryField } from '../loki/components/LokiQueryField';
import { TempoDatasource, TempoQuery, TempoQueryType } from './datasource';
import LokiDatasource from '../loki/datasource';
import { LokiQuery } from '../loki/types';
import { PrometheusDatasource } from '../prometheus/datasource';
import useAsync from 'react-use/lib/useAsync';

interface Props extends ExploreQueryFieldProps<TempoDatasource, TempoQuery>, Themeable2 {}

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
      { value: 'search', label: 'Search' },
      { value: 'traceId', label: 'TraceID' },
      { value: 'upload', label: 'JSON file' },
    ];

    if (config.featureToggles.tempoServiceGraph) {
      queryTypeOptions.push({ value: 'serviceMap', label: 'Service Map' });
    }

    return (
      <>
        <InlineFieldRow>
          <InlineField label="Query type">
            <RadioButtonGroup<TempoQueryType>
              options={queryTypeOptions}
              value={query.queryType || DEFAULT_QUERY_TYPE}
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
        {query.queryType === 'search' && (
          <SearchSection
            linkedDatasourceUid={logsDatasourceUid}
            query={query}
            onRunQuery={this.onRunLinkedQuery}
            onChange={this.onChangeLinkedQuery}
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
          <LegacyForms.FormField
            label="Trace ID"
            labelWidth={4}
            inputEl={
              <div className="slate-query-field__wrapper">
                <div className="slate-query-field" aria-label={selectors.components.QueryField.container}>
                  <input
                    style={{ width: '100%' }}
                    value={query.query || ''}
                    onChange={(e) =>
                      onChange({
                        ...query,
                        query: e.currentTarget.value,
                        queryType: 'traceId',
                        linkedQuery: undefined,
                      })
                    }
                  />
                </div>
              </div>
            }
          />
        )}
        {query.queryType === 'serviceMap' && <ServiceMapSection graphDatasourceUid={graphDatasourceUid} />}
      </>
    );
  }
}

function ServiceMapSection({ graphDatasourceUid }: { graphDatasourceUid?: string }) {
  const dsState = useAsync(() => getDS(graphDatasourceUid), [graphDatasourceUid]);
  if (dsState.loading) {
    return null;
  }

  const ds = dsState.value as LokiDatasource;

  if (!graphDatasourceUid) {
    return <div className="text-warning">Please set up a service graph datasource in the datasource settings.</div>;
  }

  if (graphDatasourceUid && !ds) {
    return (
      <div className="text-warning">
        Service graph datasource is configured but the data source no longer exists. Please configure existing data
        source to use the service graph functionality.
      </div>
    );
  }

  return null;
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

async function getDS(uid?: string): Promise<DataSourceApi | undefined> {
  if (!uid) {
    return undefined;
  }

  const dsSrv = getDataSourceSrv();
  try {
    return await dsSrv.get(uid);
  } catch (error) {
    console.error('Failed to load data source', error);
    return undefined;
  }
}

export const TempoQueryField = withTheme2(TempoQueryFieldComponent);
