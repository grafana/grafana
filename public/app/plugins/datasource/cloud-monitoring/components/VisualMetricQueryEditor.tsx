import { css } from '@emotion/css';
import debounce from 'debounce-promise';
import { startCase, uniqBy } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2, SelectableValue, TimeRange } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow } from '@grafana/plugin-ui';
import { reportInteraction } from '@grafana/runtime';
import { getSelectStyles, Select, AsyncSelect, useStyles2, useTheme2 } from '@grafana/ui';

import CloudMonitoringDatasource from '../datasource';
import { selectors } from '../e2e/selectors';
import { getAlignmentPickerData, getMetricType, setMetricType } from '../functions';
import { PreprocessorType, TimeSeriesList, MetricKind, ValueTypes } from '../types/query';
import { CustomMetaData, MetricDescriptor } from '../types/types';

import { AliasBy } from './AliasBy';
import { Alignment } from './Alignment';
import { GroupBy } from './GroupBy';
import { LabelFilter } from './LabelFilter';
import { defaultTimeSeriesList } from './MetricQueryEditor';
import { Preprocessor } from './Preprocessor';
import { Project } from './Project';

export interface Props {
  refId: string;
  customMetaData: CustomMetaData;
  onChange: (query: TimeSeriesList) => void;
  datasource: CloudMonitoringDatasource;
  query: TimeSeriesList;
  variableOptionGroup: SelectableValue<string>;
  aliasBy?: string;
  onChangeAliasBy: (aliasBy: string) => void;
  range: TimeRange;
}

export function Editor({
  refId,
  onChange,
  datasource,
  query,
  variableOptionGroup,
  customMetaData,
  aliasBy,
  onChangeAliasBy,
  range,
}: React.PropsWithChildren<Props>) {
  const [labels, setLabels] = useState<{ [k: string]: string[] }>({});
  const [metricDescriptors, setMetricDescriptors] = useState<MetricDescriptor[]>([]);
  const [metricDescriptor, setMetricDescriptor] = useState<MetricDescriptor>();
  const [metrics, setMetrics] = useState<Array<SelectableValue<string>>>([]);
  const [services, setServices] = useState<Array<SelectableValue<string>>>([]);
  const [service, setService] = useState<string>('');
  const [timeRange, setTimeRange] = useState<TimeRange>({ ...range });

  const useTime = (time: TimeRange) => {
    if (
      timeRange !== null &&
      (timeRange.raw.from.toString() !== time.raw.from.toString() ||
        timeRange.raw.to.toString() !== time.raw.to.toString())
    ) {
      setTimeRange({ ...time });
    }
  };

  useTime(range);

  const theme = useTheme2();
  const selectStyles = getSelectStyles(theme);

  const customStyle = useStyles2(getStyles);

  const { projectName, groupBys, crossSeriesReducer } = query;
  const metricType = getMetricType(query);
  const { templateSrv } = datasource;

  const getSelectedMetricDescriptor = useCallback(
    (metricDescriptors: MetricDescriptor[], metricType: string) => {
      return metricDescriptors.find((md) => md.type === templateSrv.replace(metricType))!;
    },
    [templateSrv]
  );

  useEffect(() => {
    if (projectName && metricType) {
      datasource
        .getLabels(metricType, refId, projectName, { groupBys, crossSeriesReducer }, timeRange)
        .then((labels) => setLabels(labels));
    }
  }, [datasource, groupBys, metricType, projectName, refId, crossSeriesReducer, timeRange]);

  useEffect(() => {
    const loadMetricDescriptors = async () => {
      if (projectName) {
        const metricDescriptors = await datasource.getMetricTypes(projectName);
        reportInteraction('cloud-monitoring-metric-descriptors-loaded', {
          count: metricDescriptors.length,
        });
        const services = getServicesList(metricDescriptors);
        setMetricDescriptors(metricDescriptors);
        setServices(services);
      }
    };
    loadMetricDescriptors();
  }, [datasource, projectName, customStyle, selectStyles.optionDescription]);

  useEffect(() => {
    const getMetricsList = (metricDescriptors: MetricDescriptor[]) => {
      const selectedMetricDescriptor = getSelectedMetricDescriptor(metricDescriptors, metricType);
      if (!selectedMetricDescriptor) {
        return [];
      }

      const metricsByService = metricDescriptors
        .filter((m) => m.service === selectedMetricDescriptor.service)
        .map((m) => ({
          service: m.service,
          value: m.type,
          label: m.displayName,
          component: function optionComponent() {
            return (
              <div>
                <div className={customStyle}>{m.type}</div>
                <div className={selectStyles.optionDescription}>{m.description}</div>
              </div>
            );
          },
        }));
      return metricsByService;
    };

    const metrics = getMetricsList(metricDescriptors);
    const service = metrics.length > 0 ? metrics[0].service : '';
    const metricDescriptor = getSelectedMetricDescriptor(metricDescriptors, metricType);
    setMetricDescriptor(metricDescriptor);
    setMetrics(metrics);
    setService(service);
  }, [metricDescriptors, getSelectedMetricDescriptor, metricType, customStyle, selectStyles.optionDescription]);

  const onServiceChange = ({ value: service }: SelectableValue<string>) => {
    const metrics = metricDescriptors
      .filter((m: MetricDescriptor) => m.service === templateSrv.replace(service))
      .map((m: MetricDescriptor) => ({
        service: m.service,
        value: m.type,
        label: m.displayName,
        description: m.description,
      }));
    // On service change reset all query values except the project name
    query.filters = [];

    if (metrics.length > 0 && !metrics.some((m) => m.value === templateSrv.replace(metricType))) {
      onMetricTypeChange(metrics[0]);
      setService(service!);
      setMetrics(metrics);
    } else {
      setService(service!);
      setMetrics(metrics);
    }
  };

  const getServicesList = (metricDescriptors: MetricDescriptor[]) => {
    const services = metricDescriptors.map((m) => ({
      value: m.service,
      label: startCase(m.serviceShortName),
    }));

    return services.length > 0 ? uniqBy(services, (s) => s.value) : [];
  };

  const filterMetrics = async (filter: string) => {
    const metrics = await datasource.filterMetricsByType(projectName, service);
    const filtered = metrics
      .filter((m) => m.type.includes(filter.toLowerCase()))
      .map((m) => ({
        value: m.type,
        label: m.displayName,
        component: function optionComponent() {
          return (
            <div>
              <div className={customStyle}>{m.type}</div>
              <div className={selectStyles.optionDescription}>{m.description}</div>
            </div>
          );
        },
      }));
    return [
      {
        label: 'Template Variables',
        options: variableOptionGroup.options,
      },
      ...filtered,
    ];
  };

  const debounceFilter = debounce(filterMetrics, 400);

  const onMetricTypeChange = ({ value }: SelectableValue<string>) => {
    const metricDescriptor = getSelectedMetricDescriptor(metricDescriptors, value!);
    setMetricDescriptor(metricDescriptor);
    const { metricKind, valueType } = metricDescriptor;
    const preprocessor =
      metricKind === MetricKind.GAUGE || valueType === ValueTypes.DISTRIBUTION
        ? PreprocessorType.None
        : PreprocessorType.Rate;
    const { perSeriesAligner } = getAlignmentPickerData(valueType, metricKind, query.perSeriesAligner, preprocessor);

    // On metric name change reset query to defaults except project name and filters
    Object.assign(query, {
      ...defaultTimeSeriesList(datasource),
      // If the metric value type is DISTRIBUTION use REDUCE_MEAN in order to avoid
      // returning data frames with a large number of frames (as we return a frame per bucket).
      // DISTRIBUTION metrics only typically make sense with an aggregation performed against them or
      // when filtered to a specific label value.
      crossSeriesReducer: valueType === ValueTypes.DISTRIBUTION ? 'REDUCE_MEAN' : 'REDUCE_NONE',
      projectName: query.projectName,
      filters: query.filters,
    });
    onChange({
      ...setMetricType(
        {
          ...query,
          perSeriesAligner,
        },
        value!
      ),
      preprocessor,
    });
  };

  return (
    <span data-testid={selectors.components.queryEditor.visualMetricsQueryEditor.container.input}>
      <EditorRow>
        <EditorFieldGroup>
          <Project
            refId={refId}
            templateVariableOptions={variableOptionGroup.options}
            projectName={projectName}
            datasource={datasource}
            onChange={(projectName) => {
              onChange({ ...query, projectName });
            }}
          />

          <EditorField label="Service" width="auto">
            <Select
              width="auto"
              onChange={onServiceChange}
              isLoading={services.length === 0}
              value={[...services, ...variableOptionGroup.options].find((s) => s.value === service)}
              options={[
                {
                  label: 'Template Variables',
                  options: variableOptionGroup.options,
                },
                ...services,
              ]}
              placeholder="Select Services"
              inputId={`${refId}-service`}
            />
          </EditorField>
          <EditorField label="Metric name" width="auto" htmlFor={`${refId}-select-metric`}>
            <span title={service === '' ? 'Select a service first' : 'Type to search metrics'}>
              <AsyncSelect
                width="auto"
                onChange={onMetricTypeChange}
                value={[...metrics, ...variableOptionGroup.options].find((s) => s.value === metricType)}
                loadOptions={debounceFilter}
                defaultOptions={[
                  {
                    label: 'Template Variables',
                    options: variableOptionGroup.options,
                  },
                  ...metrics.slice(0, 100),
                ]}
                placeholder="Select Metric"
                inputId={`${refId}-select-metric`}
                disabled={service === ''}
              />
            </span>
          </EditorField>
        </EditorFieldGroup>
      </EditorRow>

      <>
        <LabelFilter
          labels={labels}
          filters={query.filters!}
          onChange={(filters: string[]) => onChange({ ...query, filters })}
          variableOptionGroup={variableOptionGroup}
        />
        <EditorRow>
          <Preprocessor metricDescriptor={metricDescriptor} query={query} onChange={onChange} />
          <GroupBy
            refId={refId}
            labels={Object.keys(labels)}
            query={query}
            onChange={onChange}
            variableOptionGroup={variableOptionGroup}
            metricDescriptor={metricDescriptor}
          />
          <Alignment
            refId={refId}
            datasource={datasource}
            templateVariableOptions={variableOptionGroup.options}
            query={query}
            customMetaData={customMetaData}
            onChange={onChange}
            metricDescriptor={metricDescriptor}
            preprocessor={query.preprocessor}
          />
          <AliasBy refId={refId} value={aliasBy} onChange={onChangeAliasBy} />
        </EditorRow>
      </>
    </span>
  );
}

const getStyles = (theme: GrafanaTheme2) =>
  css({
    label: 'grafana-select-option-description',
    fontWeight: 'normal',
    fontStyle: 'italic',
    color: theme.colors.text.secondary,
  });

export const VisualMetricQueryEditor = React.memo(Editor);
