import React from 'react';
import { render, screen } from './test-utils';
import userEvent from '@testing-library/user-event';
import { selectOptionInTest } from '@grafana/ui';

import * as reducer from 'app/features/profile/state/reducers';
const updateTimeZone = jest.spyOn(reducer, 'updateTimeZone');

import { byRole } from 'testing-library-selector';
import { GeneralSettings, Props } from './GeneralSettings';
import { DashboardModel } from '../../state';
import { selectors } from '@grafana/e2e-selectors';

const setupTestContext = (options: Partial<Props>) => {
  const defaults: Props = {
    dashboard: {
      title: 'test dashboard title',
      description: 'test dashboard description',
      timepicker: {
        refresh_intervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d', '2d'],
        time_options: ['5m', '15m', '1h', '6h', '12h', '24h', '2d', '7d', '30d'],
      },
      meta: {
        folderId: 1,
        folderTitle: 'test',
      },
      timezone: 'utc',
    } as unknown as DashboardModel,
  };

  const props = { ...defaults, ...options };
  const { rerender } = render(<GeneralSettings {...props} />);

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
      userEvent.click(screen.getByTestId(selectors.components.TimeZonePicker.containerV2));
      const timeZonePicker = screen.getByTestId(selectors.components.TimeZonePicker.containerV2);
      userEvent.click(byRole('combobox').get(timeZonePicker));
      await selectOptionInTest(timeZonePicker, 'Browser Time');
      expect(updateTimeZone).toHaveBeenCalledWith({ timeZone: 'browser' });
      expect(props.dashboard.timezone).toBe('browser');
    });
  });
});
