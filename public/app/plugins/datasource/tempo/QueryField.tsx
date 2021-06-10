import { DataQuery, DataSourceApi, ExploreQueryFieldProps } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getDataSourceSrv } from '@grafana/runtime';
import { InlineField, InlineFieldRow, InlineLabel, LegacyForms, RadioButtonGroup } from '@grafana/ui';
import { TraceToLogsOptions } from 'app/core/components/TraceToLogsSettings';
import React from 'react';
import { LokiQueryField } from '../loki/components/LokiQueryField';
import { TempoDatasource, TempoQuery, TempoQueryType } from './datasource';

type Props = ExploreQueryFieldProps<TempoDatasource, TempoQuery>;
const DEFAULT_QUERY_TYPE: TempoQueryType = 'traceId';
interface State {
  linkedDatasource?: DataSourceApi;
}
export class TempoQueryField extends React.PureComponent<Props, State> {
  state = {
    linkedDatasource: undefined,
  };

  constructor(props: Props) {
    super(props);
  }

  async componentDidMount() {
    const { datasource } = this.props;
    // Find query field from linked datasource
    const tracesToLogsOptions: TraceToLogsOptions = datasource.tracesToLogs || {};
    const linkedDatasourceUid = tracesToLogsOptions.datasourceUid;
    if (linkedDatasourceUid) {
      const dsSrv = getDataSourceSrv();
      const linkedDatasource = await dsSrv.get(linkedDatasourceUid);
      this.setState({
        linkedDatasource,
      });
    }
  }

  onChangeLinkedQuery = (value: DataQuery) => {
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
    const { query, onChange } = this.props;
    const { linkedDatasource } = this.state;

    return (
      <>
        <InlineFieldRow>
          <InlineField label="Query type">
            <RadioButtonGroup<TempoQueryType>
              options={[
                { value: 'search', label: 'Search' },
                { value: 'traceId', label: 'TraceID' },
              ]}
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
        {query.queryType === 'search' && linkedDatasource && (
          <>
            <InlineLabel>
              Tempo uses {((linkedDatasource as unknown) as DataSourceApi).name} to find traces.
            </InlineLabel>

            <LokiQueryField
              datasource={linkedDatasource!}
              onChange={this.onChangeLinkedQuery}
              onRunQuery={this.onRunLinkedQuery}
              query={this.props.query.linkedQuery ?? ({ refId: 'linked' } as any)}
              history={[]}
            />
          </>
        )}
        {query.queryType === 'search' && !linkedDatasource && (
          <div className="text-warning">Please set up a Traces-to-logs datasource in the datasource settings.</div>
        )}
        {query.queryType !== 'search' && (
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
      </>
    );
  }
}
