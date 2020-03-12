import React from 'react';
import { JaegerDatasource, JaegerQuery } from './datasource';
import { ButtonCascader, CascaderOption } from '@grafana/ui';

import { ExploreQueryFieldProps } from '@grafana/data';

const ALL_OPERATIONS_KEY = '__ALL__';
const NO_TRACES_KEY = '__NO_TRACES__';

type Props = ExploreQueryFieldProps<JaegerDatasource, JaegerQuery>;
interface State {
  serviceOptions: CascaderOption[];
}

function getLabelFromTrace(trace: any): string {
  const firstSpan = trace.spans && trace.spans[0];
  if (firstSpan) {
    return `${firstSpan.operationName} [${firstSpan.duration} ms]`;
  }
  return trace.traceID;
}

export class JaegerQueryField extends React.PureComponent<Props, State> {
  constructor(props: Props, context: React.Context<any>) {
    super(props, context);
    this.state = {
      serviceOptions: [],
    };
  }

  componentDidMount() {
    this.getServices();
  }

  async getServices() {
    const url = '/api/services';
    const { datasource } = this.props;
    try {
      const res = await datasource.metadataRequest(url);
      if (res) {
        const services = res as string[];
        const serviceOptions: CascaderOption[] = services.sort().map(service => ({
          label: service,
          value: service,
          isLeaf: false,
        }));
        this.setState({ serviceOptions });
      }
    } catch (error) {
      console.error(error);
    }
  }

  onLoadOptions = async (selectedOptions: CascaderOption[]) => {
    const service = selectedOptions[0].value;
    if (selectedOptions.length === 1) {
      // Load operations
      const operations: string[] = await this.findOperations(service);
      const allOperationsOption: CascaderOption = {
        label: '[ALL]',
        value: ALL_OPERATIONS_KEY,
      };
      const operationOptions: CascaderOption[] = [
        allOperationsOption,
        ...operations.sort().map(operation => ({
          label: operation,
          value: operation,
          isLeaf: false,
        })),
      ];
      this.setState(state => {
        const serviceOptions = state.serviceOptions.map(serviceOption => {
          if (serviceOption.value === service) {
            return {
              ...serviceOption,
              children: operationOptions,
            };
          }
          return serviceOption;
        });
        return { serviceOptions };
      });
    } else if (selectedOptions.length === 2) {
      // Load traces
      const operationValue = selectedOptions[1].value;
      const operation = operationValue === ALL_OPERATIONS_KEY ? '' : operationValue;
      const traces: any[] = await this.findTraces(service, operation);
      let traceOptions: CascaderOption[] = traces.map(trace => ({
        label: getLabelFromTrace(trace),
        value: trace.traceID,
      }));
      if (traceOptions.length === 0) {
        traceOptions = [
          {
            label: '[No traces in time range]',
            value: NO_TRACES_KEY,
          },
        ];
      }
      this.setState(state => {
        // Place new traces into the correct service/operation sub-tree
        const serviceOptions = state.serviceOptions.map(serviceOption => {
          if (serviceOption.value === service) {
            const operationOptions = serviceOption.children.map(operationOption => {
              if (operationOption.value === operationValue) {
                return {
                  ...operationOption,
                  children: traceOptions,
                };
              }
              return operationOption;
            });
            return {
              ...serviceOption,
              children: operationOptions,
            };
          }
          return serviceOption;
        });
        return { serviceOptions };
      });
    }
  };

  findOperations = async (service: string) => {
    const { datasource } = this.props;
    const url = `/api/services/${service}/operations`;
    try {
      return await datasource.metadataRequest(url);
    } catch (error) {
      console.error(error);
    }
    return [];
  };

  findTraces = async (service: string, operation?: string) => {
    const { datasource } = this.props;
    const { start, end } = datasource.getTimeRange();

    const traceSearch = {
      start,
      end,
      service,
      operation,
      limit: 10,
      lookback: '1h',
      maxDuration: '',
      minDuration: '',
    };
    const url = '/api/traces';
    try {
      return await datasource.metadataRequest(url, traceSearch);
    } catch (error) {
      console.error(error);
    }
    return [];
  };

  onSelectTrace = (values: string[], selectedOptions: CascaderOption[]) => {
    const { query, onChange, onRunQuery } = this.props;
    if (selectedOptions.length === 3) {
      const traceID = selectedOptions[2].value;
      onChange({ ...query, query: traceID });
      onRunQuery();
    }
  };

  render() {
    const { query, onChange } = this.props;
    const { serviceOptions } = this.state;

    return (
      <>
        <div className="gf-form-inline gf-form-inline--nowrap">
          <div className="gf-form flex-shrink-0">
            <ButtonCascader options={serviceOptions} onChange={this.onSelectTrace} loadData={this.onLoadOptions}>
              Traces
            </ButtonCascader>
          </div>
          <div className="gf-form gf-form--grow flex-shrink-1">
            <div className={'slate-query-field__wrapper'}>
              <div className="slate-query-field">
                <input
                  style={{ width: '100%' }}
                  value={query.query || ''}
                  onChange={e =>
                    onChange({
                      ...query,
                      query: e.currentTarget.value,
                    })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }
}

export default JaegerQueryField;
