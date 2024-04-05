import { defaultsDeep } from 'lodash';
import React from 'react';
import { render, screen } from 'test/test-utils';

import { FieldType, getDefaultTimeRange, LoadingState } from '@grafana/data';
import { PanelDataErrorViewProps } from '@grafana/runtime';

import { PanelDataErrorView } from './PanelDataErrorView';

jest.mock('app/features/dashboard/services/DashboardSrv', () => ({
  getDashboardSrv: () => {
    return {
      getCurrent: () => undefined,
    };
  },
}));

describe('PanelDataErrorView', () => {
  it('show No data when there is no data', () => {
    renderWithProps();

    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('show No data when there is no data', () => {
    renderWithProps({
      data: {
        state: LoadingState.Done,
        timeRange: getDefaultTimeRange(),
        series: [
          {
            fields: [
              {
                name: 'time',
                type: FieldType.time,
                config: {},
                values: [],
              },
            ],
            length: 0,
          },
          {
            fields: [
              {
                name: 'value',
                type: FieldType.number,
                config: {},
                values: [],
              },
            ],
            length: 0,
          },
        ],
      },
    });

    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('show no value field config when there is no data', () => {
    renderWithProps({
      fieldConfig: {
        overrides: [],
        defaults: {
          noValue: 'Query returned nothing',
        },
      },
    });

    expect(screen.getByText('Query returned nothing')).toBeInTheDocument();
  });
});

function renderWithProps(overrides?: Partial<PanelDataErrorViewProps>) {
  const defaults: PanelDataErrorViewProps = {
    panelId: 1,
    data: {
      state: LoadingState.Done,
      series: [],
      timeRange: getDefaultTimeRange(),
    },
  };

  const props = defaultsDeep(overrides ?? {}, defaults);

  const stuff = render(<PanelDataErrorView {...props} />);
  return { ...stuff };
}
