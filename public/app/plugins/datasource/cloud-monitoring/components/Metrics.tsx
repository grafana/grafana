import { css } from '@emotion/css';
import { startCase, uniqBy } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';
import { getSelectStyles, Select, useStyles2, useTheme2 } from '@grafana/ui';

import { INNER_LABEL_WIDTH, LABEL_WIDTH, SELECT_WIDTH } from '../constants';
import CloudMonitoringDatasource from '../datasource';
import { MetricDescriptor } from '../types';

import { QueryEditorField, QueryEditorRow } from '.';

export interface Props {
  refId: string;
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

  const theme = useTheme2();
  const selectStyles = getSelectStyles(theme);

  const customStyle = useStyles2(getStyles);

  const { services, service, metrics, metricDescriptors } = state;
  const { metricType, templateVariableOptions, projectName, templateSrv, datasource, onChange, children } = props;

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
        setState((prevState) => ({
          ...prevState,
          metricDescriptors,
          services,
        }));
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
    setState((prevState) => ({
      ...prevState,
      metricDescriptor,
      metrics,
      service: service,
    }));
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
      <QueryEditorRow>
        <QueryEditorField labelWidth={LABEL_WIDTH} label="Service" htmlFor={`${props.refId}-service`}>
          <Select
            width={SELECT_WIDTH}
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
          ></Select>
        </QueryEditorField>
        <QueryEditorField label="Metric name" labelWidth={INNER_LABEL_WIDTH} htmlFor={`${props.refId}-select-metric`}>
          <Select
            width={SELECT_WIDTH}
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
          ></Select>
        </QueryEditorField>
      </QueryEditorRow>

      {children(state.metricDescriptor)}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => css`
  label: grafana-select-option-description;
  font-weight: normal;
  font-style: italic;
  color: ${theme.colors.text.secondary};
`;
