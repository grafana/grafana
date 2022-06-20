import { render, screen } from '@testing-library/react';
import React from 'react';
import { openMenu, select } from 'react-select-event';

import { createMockDatasource } from '../../__mocks__/cloudMonitoringDatasource';
import { createMockMetricDescriptor } from '../../__mocks__/cloudMonitoringMetricDescriptor';

import { Metrics } from './Metrics';

describe('Metrics', () => {
  it('renders metrics fields', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource();

    render(
      <Metrics
        refId="refId"
        metricType=""
        projectName="projectName"
        templateVariableOptions={[]}
        datasource={datasource}
        onChange={onChange}
      >
        {() => <div />}
      </Metrics>
    );

    expect(await screen.findByLabelText('Service')).toBeInTheDocument();
    expect(await screen.findByLabelText('Metric name')).toBeInTheDocument();
  });

  it('can select a service', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource({
      getMetricTypes: jest.fn().mockResolvedValue([createMockMetricDescriptor()]),
    });

    render(
      <Metrics
        refId="refId"
        metricType=""
        projectName="projectName"
        templateVariableOptions={[]}
        datasource={datasource}
        onChange={onChange}
      >
        {() => <div />}
      </Metrics>
    );

    const service = await screen.findByLabelText('Service');
    await openMenu(service);
    await select(service, 'Srv', { container: document.body });
    expect(onChange).toBeCalledWith(expect.objectContaining({ service: 'service' }));
  });

  it('can select a metric name', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource({
      getMetricTypes: jest.fn().mockResolvedValue([createMockMetricDescriptor()]),
    });

    render(
      <Metrics
        refId="refId"
        metricType="type"
        projectName="projectName"
        templateVariableOptions={[]}
        datasource={datasource}
        onChange={onChange}
      >
        {() => <div />}
      </Metrics>
    );

    const metricName = await screen.findByLabelText('Metric name');
    await openMenu(metricName);
    await select(metricName, 'metricName', { container: document.body });
    expect(onChange).toBeCalledWith(expect.objectContaining({ type: 'type' }));
  });
});
