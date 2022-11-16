import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { byRole } from 'testing-library-selector';

import { selectors } from '@grafana/e2e-selectors';
import { BackendSrv, setBackendSrv } from '@grafana/runtime';
import { GrafanaContext } from 'app/core/context/GrafanaContext';

import { configureStore } from '../../../../store/configureStore';
import { DashboardModel } from '../../state';

import { GeneralSettingsUnconnected as GeneralSettings, Props } from './GeneralSettings';

setBackendSrv({
  get: jest.fn().mockResolvedValue([]),
} as unknown as BackendSrv);

const setupTestContext = (options: Partial<Props>) => {
  const store = configureStore();
  const defaults: Props = {
    dashboard: new DashboardModel(
      {
        title: 'test dashboard title',
        description: 'test dashboard description',
        timepicker: {
          refresh_intervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d', '2d'],
          time_options: ['5m', '15m', '1h', '6h', '12h', '24h', '2d', '7d', '30d'],
        },
        timezone: 'utc',
      },
      {
        folderId: 1,
        folderTitle: 'test',
      }
    ),
    updateTimeZone: jest.fn(),
    updateWeekStart: jest.fn(),
    sectionNav: {
      main: { text: 'Dashboard' },
      node: {
        text: 'Settings',
      },
    },
  };

  const props = { ...defaults, ...options };

  const { rerender } = render(
    <GrafanaContext.Provider value={getGrafanaContextMock()}>
      <Provider store={store}>
        <BrowserRouter>
          <GeneralSettings {...props} />
        </BrowserRouter>
      </Provider>
    </GrafanaContext.Provider>
  );

  return { rerender, props };
};

describe('General Settings', () => {
  describe('when component is mounted with timezone', () => {
    it('should render correctly', async () => {
      setupTestContext({});
      screen.getByDisplayValue('test dashboard title');
      screen.getByDisplayValue('test dashboard description');
      expect(await screen.findByTestId(selectors.components.TimeZonePicker.containerV2)).toHaveTextContent(
        'Coordinated Universal Time'
      );
    });
  });

  describe('when timezone is changed', () => {
    it('should call update function', async () => {
      const { props } = setupTestContext({});
      await userEvent.click(screen.getByTestId(selectors.components.TimeZonePicker.containerV2));
      const timeZonePicker = screen.getByTestId(selectors.components.TimeZonePicker.containerV2);
      await userEvent.click(byRole('combobox').get(timeZonePicker));
      await selectOptionInTest(timeZonePicker, 'Browser Time');
      expect(props.updateTimeZone).toHaveBeenCalledWith('browser');
      expect(props.dashboard.timezone).toBe('browser');
    });
  });
});
