import React, { useCallback, useEffect, useState } from 'react';
import { startCase, uniqBy } from 'lodash';

import { InlineField, Select } from '@grafana/ui';
import { TemplateSrv } from '@grafana/runtime';
import { SelectableValue } from '@grafana/data';
import { InlineFields } from '.';
import CloudMonitoringDatasource from '../datasource';
import { LABEL_WIDTH } from '../constants';
import { MetricDescriptor } from '../types';

export interface Props {
  onChange: (metricDescriptor: MetricDescriptor) => void;
  templateSrv: TemplateSrv;
  templateVariableOptions: Array<SelectableValue<string>>;
  datasource: CloudMonitoringDatasource;
  projectName: string;
  metricType: string;
  children: (metricDescriptor?: MetricDescriptor) => JSX.Element;
}

interface State {
  metricDescriptors: MetricDescriptor[];
  metrics: any[];
  services: any[];
  service: string;
  metric: string;
  metricDescriptor?: MetricDescriptor;
  projectName: string | null;
}

export function Metrics(props: Props) {
  const [state, setState] = useState<State>({
    metricDescriptors: [],
    metrics: [],
    services: [],
    service: '',
    metric: '',
    projectName: null,
  });

  const { services, service, metrics, metricDescriptors } = state;
  const { metricType, templateVariableOptions, projectName, templateSrv, datasource, onChange, children } = props;

  const getSelectedMetricDescriptor = useCallback(
    (metricDescriptors: MetricDescriptor[], metricType: string) => {
      return metricDescriptors.find((md) => md.type === templateSrv.replace(metricType))!;
    },
    [templateSrv]
  );

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
          description: m.description,
        }));
      return metricsByService;
    };

    const loadMetricDescriptors = async () => {
      if (projectName) {
        const metricDescriptors = await datasource.getMetricTypes(projectName);
        const services = getServicesList(metricDescriptors);
        const metrics = getMetricsList(metricDescriptors);
        const service = metrics.length > 0 ? metrics[0].service : '';
        const metricDescriptor = getSelectedMetricDescriptor(metricDescriptors, metricType);
        setState((prevState) => ({
          ...prevState,
          metricDescriptors,
          services,
          metrics,
          service: service,
          metricDescriptor,
        }));
      }
    };
    loadMetricDescriptors();
  }, [datasource, getSelectedMetricDescriptor, metricType, projectName]);

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
      onMetricTypeChange(metrics[0], { service, metrics });
    } else {
      setState({ ...state, service, metrics });
    }
  };

  const onMetricTypeChange = ({ value }: SelectableValue<string>, extra: any = {}) => {
    const metricDescriptor = getSelectedMetricDescriptor(state.metricDescriptors, value!);
    setState({ ...state, metricDescriptor, ...extra });
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
      <InlineFields transparent label="Metric" labelWidth={LABEL_WIDTH}>
        <InlineField className="width-16" label="Service">
          <Select
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
          ></Select>
        </InlineField>
        <InlineField label="Metric name">
          <Select
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
          ></Select>
        </InlineField>
      </InlineFields>

      {children(state.metricDescriptor)}
    </>
  );
}
