import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openMenu } from 'react-select-event';

import { CustomVariableModel } from '@grafana/data';

import { createMockDatasource } from '../mocks/cloudMonitoringDatasource';
import { createMockMetricDescriptor } from '../mocks/cloudMonitoringMetricDescriptor';
import { createMockTimeSeriesList } from '../mocks/cloudMonitoringQuery';
import { MetricKind, ValueTypes } from '../types/query';

import { Alignment } from './Alignment';

let getTempVars = () => [] as CustomVariableModel[];
let replace = () => '';

jest.mock('@grafana/runtime', () => {
  return {
    __esModule: true,
    ...jest.requireActual('@grafana/runtime'),
    getTemplateSrv: () => ({
      replace: replace,
      getVariables: getTempVars,
      updateTimeRange: jest.fn(),
      containsTemplate: jest.fn(),
    }),
  };
});

describe('Alignment', () => {
  it('renders alignment fields', () => {
    const datasource = createMockDatasource();
    const query = createMockTimeSeriesList();
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
    const query = createMockTimeSeriesList();
    const onChange = jest.fn();

    render(
      <Alignment
        refId="refId"
        customMetaData={{}}
        datasource={datasource}
        query={query}
        onChange={onChange}
        templateVariableOptions={[]}
        metricDescriptor={createMockMetricDescriptor({ metricKind: MetricKind.GAUGE, valueType: ValueTypes.INT64 })}
      />
    );

    const alignmentFunction = screen.getByLabelText('Alignment function');
    openMenu(alignmentFunction);
    await userEvent.click(screen.getByText('percent change'));
    expect(onChange).toBeCalledWith(expect.objectContaining({ perSeriesAligner: 'ALIGN_PERCENT_CHANGE' }));
  });

  it('can set the alignment period', async () => {
    const datasource = createMockDatasource();
    const query = createMockTimeSeriesList();
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
