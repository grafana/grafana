import { css } from '@emotion/css';
import { startCase, uniqBy } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow } from '@grafana/experimental';
import { getSelectStyles, Select, useStyles2, useTheme2 } from '@grafana/ui';

import CloudMonitoringDatasource from '../datasource';
import { MetricDescriptor, MetricQuery } from '../types';

import { Project } from './Project';

export interface Props {
  refId: string;
  onChange: (metricDescriptor: MetricDescriptor) => void;
  templateVariableOptions: Array<SelectableValue<string>>;
  datasource: CloudMonitoringDatasource;
  projectName: string;
  metricType: string;
  query: MetricQuery;
  children: (metricDescriptor?: MetricDescriptor) => JSX.Element;
  onProjectChange: (query: MetricQuery) => void;
}

export function Metrics(props: Props) {
  const [metricDescriptors, setMetricDescriptors] = useState<MetricDescriptor[]>([]);
  const [metricDescriptor, setMetricDescriptor] = useState<MetricDescriptor>();
  const [metrics, setMetrics] = useState<Array<SelectableValue<string>>>([]);
  const [services, setServices] = useState<Array<SelectableValue<string>>>([]);
  const [service, setService] = useState<string>('');

  const theme = useTheme2();
  const selectStyles = getSelectStyles(theme);

  const customStyle = useStyles2(getStyles);

  const {
    onProjectChange,
    query,
    refId,
    metricType,
    templateVariableOptions,
    projectName,
    datasource,
    onChange,
    children,
  } = props;
  const { templateSrv } = datasource;

  const getSelectedMetricDescriptor = useCallback(
    (metricDescriptors: MetricDescriptor[], metricType: string) => {
      return metricDescriptors.find((md) => md.type === templateSrv.replace(metricType))!;
    },
    [templateSrv]
  );

  useEffect(() => {
    const loadMetricDescriptors = async () => {
      if (projectName) {
        const metricDescriptors = await datasource.getMetricTypes(projectName);
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

  const onServiceChange = ({ value: service }: any) => {
    const metrics = metricDescriptors
      .filter((m: MetricDescriptor) => m.service === templateSrv.replace(service))
      .map((m: MetricDescriptor) => ({
        service: m.service,
        value: m.type,
        label: m.displayName,
        description: m.description,
      }));

    if (metrics.length > 0 && !metrics.some((m) => m.value === templateSrv.replace(metricType))) {
      onMetricTypeChange(metrics[0]);
      setService(service);
      setMetrics(metrics);
    } else {
      setService(service);
      setMetrics(metrics);
    }
  };

  const onMetricTypeChange = ({ value }: SelectableValue<string>) => {
    const metricDescriptor = getSelectedMetricDescriptor(metricDescriptors, value!);
    setMetricDescriptor(metricDescriptor);
    onChange({ ...metricDescriptor, type: value! });
  };

  const getServicesList = (metricDescriptors: MetricDescriptor[]) => {
    const services = metricDescriptors.map((m) => ({
      value: m.service,
      label: startCase(m.serviceShortName),
    }));

    return services.length > 0 ? uniqBy(services, (s) => s.value) : [];
  };

  return (
    <>
      <EditorRow>
        <EditorFieldGroup>
          <Project
            refId={refId}
            templateVariableOptions={templateVariableOptions}
            projectName={projectName}
            datasource={datasource}
            onChange={(projectName) => {
              onProjectChange({ ...query, projectName });
            }}
          />

          <EditorField label="Service" width="auto">
            <Select
              width="auto"
              onChange={onServiceChange}
              value={[...services, ...templateVariableOptions].find((s) => s.value === service)}
              options={[
                {
                  label: 'Template Variables',
                  options: templateVariableOptions,
                },
                ...services,
              ]}
              placeholder="Select Services"
              inputId={`${props.refId}-service`}
            />
          </EditorField>
          <EditorField label="Metric name" width="auto">
            <Select
              width="auto"
              onChange={onMetricTypeChange}
              value={[...metrics, ...templateVariableOptions].find((s) => s.value === metricType)}
              options={[
                {
                  label: 'Template Variables',
                  options: templateVariableOptions,
                },
                ...metrics,
              ]}
              placeholder="Select Metric"
              inputId={`${props.refId}-select-metric`}
            />
          </EditorField>
        </EditorFieldGroup>
      </EditorRow>

      {children(metricDescriptor)}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => css`
  label: grafana-select-option-description;
  font-weight: normal;
  font-style: italic;
  color: ${theme.colors.text.secondary};
`;
