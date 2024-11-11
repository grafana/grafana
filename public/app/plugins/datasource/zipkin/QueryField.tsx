import { css } from '@emotion/css';
import { fromPairs } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAsyncFn, useMount, useMountedState } from 'react-use';
import { AsyncState } from 'react-use/lib/useAsyncFn';

import { GrafanaTheme2, QueryEditorProps } from '@grafana/data';
import { TemporaryAlert } from '@grafana/o11y-ds-frontend';
import {
  ButtonCascader,
  CascaderOption,
  FileDropzone,
  InlineField,
  InlineFieldRow,
  RadioButtonGroup,
  useTheme2,
  QueryField,
  useStyles2,
  Modal,
  HorizontalGroup,
  Button,
} from '@grafana/ui';

import { ZipkinDatasource } from './datasource';
import { ZipkinQuery, ZipkinQueryType, ZipkinSpan } from './types';

type Props = QueryEditorProps<ZipkinDatasource, ZipkinQuery>;

const getStyles = (theme: GrafanaTheme2) => {
  return {
    tracesCascader: css({
      label: 'tracesCascader',
      marginRight: theme.spacing(1),
    }),
  };
};

export const ZipkinQueryField = ({ query, onChange, onRunQuery, datasource }: Props) => {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [alertText, setAlertText] = useState('');
  const serviceOptions = useServices(datasource, setAlertText);
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { onLoadOptions, allOptions } = useLoadOptions(datasource, setAlertText);

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

  useEffect(() => {
    if (!query.queryType) {
      onChange({
        ...query,
        queryType: 'traceID',
      });
    }
  }, [query, onChange]);

  const onChangeQuery = (value: string) => {
    const nextQuery = { ...query, query: value };
    onChange(nextQuery);
  };

  let cascaderOptions = useMapToCascaderOptions(serviceOptions, allOptions);

  return (
    <>
      <Modal title={'Upload trace'} isOpen={uploadModalOpen} onDismiss={() => setUploadModalOpen(false)}>
        <div className={css({ padding: theme.spacing(2) })}>
          <FileDropzone
            options={{ multiple: false }}
            onLoad={(result) => {
              datasource.uploadedJson = result;
              onChange({
                ...query,
                queryType: 'upload',
              });
              setUploadModalOpen(false);
              onRunQuery();
            }}
          />
        </div>
      </Modal>
      <InlineFieldRow>
        <InlineField label="Query type" grow={true}>
          <HorizontalGroup spacing={'sm'} align={'center'} justify={'space-between'}>
            <RadioButtonGroup<ZipkinQueryType>
              options={[{ value: 'traceID', label: 'TraceID' }]}
              value={query.queryType || 'traceID'}
              onChange={(v) =>
                onChange({
                  ...query,
                  queryType: v,
                })
              }
              size="md"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setUploadModalOpen(true);
              }}
            >
              Import trace
            </Button>
          </HorizontalGroup>
        </InlineField>
      </InlineFieldRow>
      {query.queryType === 'traceID' && (
        <InlineFieldRow>
          <ButtonCascader
            options={cascaderOptions}
            onChange={onSelectTrace}
            loadData={onLoadOptions}
            variant="secondary"
            buttonProps={{ className: styles.tracesCascader }}
          >
            Traces
          </ButtonCascader>
          <div className="gf-form gf-form--grow flex-shrink-1 min-width-15">
            <QueryField
              query={query.query}
              onChange={onChangeQuery}
              onRunQuery={onRunQuery}
              placeholder={'Insert Trace ID (run with Shift+Enter)'}
              portalOrigin="zipkin"
            />
          </div>
        </InlineFieldRow>
      )}
      {alertText && <TemporaryAlert text={alertText} severity={'error'} />}
    </>
  );
};

// Exported for tests
export function useServices(
  datasource: ZipkinDatasource,
  setErrorText: (text: string) => void
): AsyncState<CascaderOption[]> {
  const [servicesOptions, fetch] = useAsyncFn(async (): Promise<CascaderOption[]> => {
    try {
      const services: string[] | null = await datasource.metadataRequest('services');
      if (services) {
        return services.sort().map((service) => ({
          label: service,
          value: service,
          isLeaf: false,
        }));
      }
      return [];
    } catch (error) {
      const errorToShow = error instanceof Error ? error : 'An unknown error occurred';
      const errorText = `Failed to load spans from Zipkin: ${errorToShow.toString()}`;
      setErrorText(errorText);
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
export function useLoadOptions(datasource: ZipkinDatasource, setErrorText: (text: string) => void) {
  const isMounted = useMountedState();
  const [allOptions, setAllOptions] = useState<OptionsState>({});

  const [, fetchSpans] = useAsyncFn(
    async function findSpans(service: string): Promise<void> {
      try {
        // The response of this should have been full ZipkinSpan objects based on API docs but is just list
        // of span names.
        // TODO: check if this is some issue of version used or something else
        const response: string[] = await datasource.metadataRequest('spans', { serviceName: service });
        if (isMounted()) {
          setAllOptions((state) => {
            const spanOptions = fromPairs(response.map((span: string) => [span, undefined]));
            return {
              ...state,
              [service]: spanOptions as any,
            };
          });
        }
      } catch (error) {
        const errorToShow = error instanceof Error ? error : 'An unknown error occurred';
        const errorText = `Failed to load spans from Zipkin: ${errorToShow.toString()}`;
        setErrorText(errorText);
        throw error;
      }
    },
    [datasource, allOptions]
  );

  const [, fetchTraces] = useAsyncFn(
    async function findTraces(serviceName: string, spanName: string): Promise<void> {
      const search = {
        serviceName,
        spanName,
        // See other params and default here https://zipkin.io/zipkin-api/#/default/get_traces
      };
      try {
        // This should return just root traces as there isn't any nesting
        const traces: ZipkinSpan[][] = await datasource.metadataRequest('traces', search);
        if (isMounted()) {
          const newTraces = traces.length
            ? fromPairs(
                traces.map((trace) => {
                  const rootSpan = trace.find((span) => !span.parentId)!;

                  return [`${rootSpan.name} [${Math.floor(rootSpan.duration / 1000)} ms]`, rootSpan.traceId];
                })
              )
            : noTracesOptions;

          setAllOptions((state) => {
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
        const errorToShow = error instanceof Error ? error : 'An unknown error occurred';
        const errorText = `Failed to load spans from Zipkin: ${errorToShow.toString()}`;
        setErrorText(errorText);
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
      cascaderOptions = services.value.map((services) => {
        return {
          ...services,
          children:
            allOptions[services.value] &&
            Object.keys(allOptions[services.value]).map((spanName) => {
              return {
                label: spanName,
                value: spanName,
                isLeaf: false,
                children:
                  allOptions[services.value][spanName] &&
                  Object.keys(allOptions[services.value][spanName]).map((traceName) => {
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
