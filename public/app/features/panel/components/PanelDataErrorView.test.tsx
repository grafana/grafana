import React from 'react';
import { render, screen } from '@testing-library/react';
import { defaultsDeep } from 'lodash';
import { PanelDataErrorView } from './PanelDataErrorView';
import { PanelDataErrorViewProps } from '@grafana/runtime';
import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { Provider } from 'react-redux';
import { configureStore } from 'app/store/configureStore';

describe('PanelDataErrorView', () => {
  it('show No data when there is no data', () => {
    renderWithProps();

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
