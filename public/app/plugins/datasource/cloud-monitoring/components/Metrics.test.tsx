import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { openMenu, select } from 'react-select-event';

import { createMockDatasource } from '../__mocks__/cloudMonitoringDatasource';
import { createMockMetricDescriptor } from '../__mocks__/cloudMonitoringMetricDescriptor';
import { createMockMetricQuery } from '../__mocks__/cloudMonitoringQuery';

import { Metrics } from './Metrics';

describe('Metrics', () => {
  it('renders metrics fields', async () => {
    const onChange = jest.fn();
    const query = createMockMetricQuery();
    const datasource = createMockDatasource();

    render(
      <Metrics
        refId="refId"
        metricType=""
        projectName="projectName"
        templateVariableOptions={[]}
        datasource={datasource}
        onChange={onChange}
        onProjectChange={jest.fn()}
        query={query}
      >
        {() => <div />}
      </Metrics>
    );

    expect(await screen.findByLabelText('Service')).toBeInTheDocument();
    expect(await screen.findByLabelText('Metric name')).toBeInTheDocument();
  });

  it('can select a service', async () => {
    const onChange = jest.fn();
    const query = createMockMetricQuery();
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
        onProjectChange={jest.fn()}
        query={query}
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
    const query = createMockMetricQuery();
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
        onProjectChange={jest.fn()}
        query={query}
      >
        {() => <div />}
      </Metrics>
    );

    const metricName = await screen.findByLabelText('Metric name');
    await openMenu(metricName);
    await select(metricName, 'metricName', { container: document.body });
    expect(onChange).toBeCalledWith(expect.objectContaining({ type: 'type' }));
  });

  it('should render available metric options according to the selected service', async () => {
    const onChange = jest.fn();
    const query = createMockMetricQuery();
    const datasource = createMockDatasource({
      getMetricTypes: jest.fn().mockResolvedValue([
        createMockMetricDescriptor({
          service: 'service_a',
          serviceShortName: 'srv_a',
          type: 'metric1',
          description: 'description_metric1',
          displayName: 'displayName_metric1',
        }),
        createMockMetricDescriptor({
          service: 'service_b',
          serviceShortName: 'srv_b',
          type: 'metric2',
          description: 'description_metric2',
          displayName: 'displayName_metric2',
        }),
        createMockMetricDescriptor({
          service: 'service_b',
          serviceShortName: 'srv_b',
          type: 'metric3',
          description: 'description_metric3',
          displayName: 'displayName_metric3',
        }),
      ]),
    });

    render(
      <Metrics
        refId="refId"
        metricType="metric1"
        projectName="projectName"
        templateVariableOptions={[]}
        datasource={datasource}
        onChange={onChange}
        onProjectChange={jest.fn()}
        query={query}
      >
        {() => <div />}
      </Metrics>
    );

    const metricName = await screen.findByLabelText('Metric name');
    await openMenu(metricName);

    const metricNameOptions = screen.getByLabelText('Select options menu');
    expect(within(metricNameOptions).getByText('description_metric1')).toBeInTheDocument();
    expect(within(metricNameOptions).getByText('displayName_metric1')).toBeInTheDocument();
    expect(within(metricNameOptions).queryByText('displayName_metric2')).not.toBeInTheDocument();
    expect(within(metricNameOptions).queryByText('description_metric2')).not.toBeInTheDocument();
    expect(within(metricNameOptions).queryByText('displayName_metric3')).not.toBeInTheDocument();
    expect(within(metricNameOptions).queryByText('description_metric3')).not.toBeInTheDocument();

    await select(screen.getByLabelText('Service'), 'Srv B', { container: document.body });
    expect(within(metricNameOptions).queryByText('displayName_metric1')).not.toBeInTheDocument();
    expect(within(metricNameOptions).queryByText('description_metric1')).not.toBeInTheDocument();
    expect(within(metricNameOptions).getByText('displayName_metric2')).toBeInTheDocument();
    expect(within(metricNameOptions).getByText('description_metric2')).toBeInTheDocument();
    expect(within(metricNameOptions).getByText('displayName_metric3')).toBeInTheDocument();
    expect(within(metricNameOptions).getByText('description_metric3')).toBeInTheDocument();
  });

  it('should have a distinct list of services', async () => {
    const onChange = jest.fn();
    const datasource = createMockDatasource({
      getMetricTypes: jest.fn().mockResolvedValue([
        createMockMetricDescriptor({
          service: 'service_a',
          serviceShortName: 'srv_a',
          type: 'metric1',
          description: 'description_metric1',
          displayName: 'displayName_metric1',
        }),
        createMockMetricDescriptor({
          service: 'service_b',
          serviceShortName: 'srv_b',
          type: 'metric2',
          description: 'description_metric2',
          displayName: 'displayName_metric2',
        }),
        createMockMetricDescriptor({
          service: 'service_b',
          serviceShortName: 'srv_b',
          type: 'metric3',
          description: 'description_metric3',
          displayName: 'displayName_metric3',
        }),
      ]),
    });
    const query = createMockMetricQuery();

    render(
      <Metrics
        refId="refId"
        metricType="metric1"
        projectName="projectName"
        templateVariableOptions={[]}
        datasource={datasource}
        onChange={onChange}
        onProjectChange={jest.fn()}
        query={query}
      >
        {() => <div />}
      </Metrics>
    );
    const service = await screen.findByLabelText('Service');
    await openMenu(service);
    expect(screen.getAllByLabelText('Select option').length).toEqual(2);
  });
});
