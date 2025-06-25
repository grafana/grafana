import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { render } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { selectors } from '@grafana/e2e-selectors';
import { BackendSrv, setBackendSrv } from '@grafana/runtime';

import { createDashboardModelFixture } from '../../state/__fixtures__/dashboardFixtures';

import { GeneralSettingsUnconnected as GeneralSettings, Props } from './GeneralSettings';

setBackendSrv({
  get: jest.fn().mockResolvedValue([]),
} as unknown as BackendSrv);

const setupTestContext = (options: Partial<Props>) => {
  const defaults: Props = {
    dashboard: createDashboardModelFixture(
      {
        title: 'test dashboard title',
        description: 'test dashboard description',
        timepicker: {
          refresh_intervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d', '2d'],
          hidden: false,
        },
        timezone: 'utc',
      },
      {
        folderUid: 'abc',
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
    it.skip('should call update function', async () => {
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
