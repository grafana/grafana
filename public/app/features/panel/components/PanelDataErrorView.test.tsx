import { render, screen } from '@testing-library/react';
import { defaultsDeep } from 'lodash';
import React from 'react';
import { Provider } from 'react-redux';

import { FieldType, getDefaultTimeRange, LoadingState } from '@grafana/data';
import { PanelDataErrorViewProps } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import { PanelDataErrorView } from './PanelDataErrorView';

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
  const store = configureStore();

  const stuff = render(
    <Provider store={store}>
      <PanelDataErrorView {...props} />
    </Provider>
  );
  return { ...stuff };
}
