import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { openMenu } from 'react-select-event';

import { TemplateSrvMock } from 'app/features/templating/template_srv.mock';

import { createMockDatasource } from '../__mocks__/cloudMonitoringDatasource';
import { createMockMetricQuery } from '../__mocks__/cloudMonitoringQuery';
import { MetricKind, ValueTypes } from '../types';

import { Alignment } from './Alignment';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => new TemplateSrvMock({}),
}));

describe('Alignment', () => {
  it('renders alignment fields', () => {
    const datasource = createMockDatasource();
    const query = createMockMetricQuery();
    const onChange = jest.fn();

    render(
      <Alignment
        refId="refId"
        customMetaData={{}}
        datasource={datasource}
        query={query}
        onChange={onChange}
        templateVariableOptions={[]}
      />
    );

    expect(screen.getByLabelText('Alignment function')).toBeInTheDocument();
    expect(screen.getByLabelText('Alignment period')).toBeInTheDocument();
  });

  it('can set the alignment function', async () => {
    const datasource = createMockDatasource();
    const query = createMockMetricQuery({ metricKind: MetricKind.GAUGE, valueType: ValueTypes.INT64 });
    const onChange = jest.fn();

    render(
      <Alignment
        refId="refId"
        customMetaData={{}}
        datasource={datasource}
        query={query}
        onChange={onChange}
        templateVariableOptions={[]}
      />
    );

    const alignmentFunction = screen.getByLabelText('Alignment function');
    openMenu(alignmentFunction);
    await userEvent.click(screen.getByText('percent change'));
    expect(onChange).toBeCalledWith(expect.objectContaining({ perSeriesAligner: 'ALIGN_PERCENT_CHANGE' }));
  });

  it('can set the alignment period', async () => {
    const datasource = createMockDatasource();
    const query = createMockMetricQuery();
    const onChange = jest.fn();

    render(
      <Alignment
        refId="refId"
        customMetaData={{}}
        datasource={datasource}
        query={query}
        onChange={onChange}
        templateVariableOptions={[]}
      />
    );

    const alignmentPeriod = screen.getByLabelText('Alignment period');
    openMenu(alignmentPeriod);
    await userEvent.click(screen.getByText('1m'));
    expect(onChange).toBeCalledWith(expect.objectContaining({ alignmentPeriod: '+60s' }));
  });
});
