import React, { useCallback, useMemo, useState } from 'react';
import { ZipkinDatasource, ZipkinQuery } from './datasource';
import { AppEvents, ExploreQueryFieldProps } from '@grafana/data';
import { ButtonCascader, CascaderOption } from '@grafana/ui';
import { useAsyncFn, useMount, useMountedState } from 'react-use';
import { appEvents } from '../../../core/core';
import { apiPrefix } from './constants';
import { ZipkinSpan } from './types';
import { fromPairs } from 'lodash';
import { AsyncState } from 'react-use/lib/useAsyncFn';

type Props = ExploreQueryFieldProps<ZipkinDatasource, ZipkinQuery>;

export const QueryField = ({ query, onChange, onRunQuery, datasource }: Props) => {
  const serviceOptions = useServices(datasource);
  const { onLoadOptions, allOptions } = useLoadOptions(datasource);

  const onSelectTrace = useCallback(
    (values: string[], selectedOptions: CascaderOption[]) => {
      if (selectedOptions.length === 3) {
        const traceID = selectedOptions[2].value;
        onChange({ ...query, query: traceID });
        onRunQuery();
      }
    },
    [onChange, onRunQuery, query]
  );

  let cascaderOptions = useMapToCascaderOptions(serviceOptions, allOptions);

  return (
    <>
      <div className="gf-form-inline gf-form-inline--nowrap">
        <div className="gf-form flex-shrink-0">
          <ButtonCascader options={cascaderOptions} onChange={onSelectTrace} loadData={onLoadOptions}>
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
};

// Exported for tests
export function useServices(datasource: ZipkinDatasource): AsyncState<CascaderOption[]> {
  const url = `${apiPrefix}/services`;

  const [servicesOptions, fetch] = useAsyncFn(async (): Promise<CascaderOption[]> => {
    try {
      const services: string[] | null = await datasource.metadataRequest(url);
      if (services) {
        return services.sort().map(service => ({
          label: service,
          value: service,
          isLeaf: false,
        }));
      }
      return [];
    } catch (error) {
      appEvents.emit(AppEvents.alertError, ['Failed to load services from Zipkin', error]);
      throw error;
    }
  }, [datasource]);

  useMount(() => {
    // We should probably call this periodically to get new services after mount.
    fetch();
  });

  return servicesOptions;
}

type OptionsState = {
  [serviceName: string]: {
    [spanName: string]: {
      [traceId: string]: string;
    };
  };
};

// Exported for tests
export function useLoadOptions(datasource: ZipkinDatasource) {
  const isMounted = useMountedState();
  const [allOptions, setAllOptions] = useState({} as OptionsState);

  const [, fetchSpans] = useAsyncFn(
    async function findSpans(service: string): Promise<void> {
      const url = `${apiPrefix}/spans`;
      try {
        // The response of this should have been full ZipkinSpan objects based on API docs but is just list
        // of span names.
        // TODO: check if this is some issue of version used or something else
        const response: string[] = await datasource.metadataRequest(url, { serviceName: service });
        if (isMounted()) {
          setAllOptions(state => {
            const spanOptions = fromPairs(response.map((span: string) => [span, undefined]));
            return {
              ...state,
              [service]: spanOptions as any,
            };
          });
        }
      } catch (error) {
        appEvents.emit(AppEvents.alertError, ['Failed to load spans from Zipkin', error]);
        throw error;
      }
    },
    [datasource, allOptions]
  );

  const [, fetchTraces] = useAsyncFn(
    async function findTraces(serviceName: string, spanName: string): Promise<void> {
      const url = `${apiPrefix}/traces`;
      const search = {
        serviceName,
        spanName,
        // See other params and default here https://zipkin.io/zipkin-api/#/default/get_traces
      };
      try {
        // This should return just root traces as there isn't any nesting
        const traces: ZipkinSpan[][] = await datasource.metadataRequest(url, search);
        if (isMounted()) {
          const newTraces = traces.length
            ? fromPairs(
                traces.map(trace => {
                  const rootSpan = trace.find(span => !span.parentId)!;

                  return [`${rootSpan.name} [${Math.floor(rootSpan.duration / 1000)} ms]`, rootSpan.traceId];
                })
              )
            : noTracesOptions;

          setAllOptions(state => {
            const spans = state[serviceName];
            return {
              ...state,
              [serviceName]: {
                ...spans,
                [spanName]: newTraces,
              },
            };
          });
        }
      } catch (error) {
        appEvents.emit(AppEvents.alertError, ['Failed to load spans from Zipkin', error]);
        throw error;
      }
    },
    [datasource]
  );

  const onLoadOptions = useCallback(
    (selectedOptions: CascaderOption[]) => {
      const service = selectedOptions[0].value;
      if (selectedOptions.length === 1) {
        fetchSpans(service);
      } else if (selectedOptions.length === 2) {
        const spanName = selectedOptions[1].value;
        fetchTraces(service, spanName);
      }
    },
    [fetchSpans, fetchTraces]
  );

  return {
    onLoadOptions,
    allOptions,
  };
}

function useMapToCascaderOptions(services: AsyncState<CascaderOption[]>, allOptions: OptionsState) {
  return useMemo(() => {
    let cascaderOptions: CascaderOption[] = [];

    if (services.value && services.value.length) {
      cascaderOptions = services.value.map(services => {
        return {
          ...services,
          children:
            allOptions[services.value] &&
            Object.keys(allOptions[services.value]).map(spanName => {
              return {
                label: spanName,
                value: spanName,
                isLeaf: false,
                children:
                  allOptions[services.value][spanName] &&
                  Object.keys(allOptions[services.value][spanName]).map(traceName => {
                    return {
                      label: traceName,
                      value: allOptions[services.value][spanName][traceName],
                    };
                  }),
              };
            }),
        };
      });
    } else if (services.value && !services.value.length) {
      cascaderOptions = noTracesFoundOptions;
    }

    return cascaderOptions;
  }, [services, allOptions]);
}

const NO_TRACES_KEY = '__NO_TRACES__';
const noTracesFoundOptions = [
  {
    label: 'No traces found',
    value: 'no_traces',
    isLeaf: true,

    // Cannot be disabled because then cascader shows 'loading' for some reason.
    // disabled: true,
  },
];

const noTracesOptions = {
  '[No traces in time range]': NO_TRACES_KEY,
};
