import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { config } from '@grafana/runtime';

import { createDefaultConfigOptions } from '../mocks/datasource';

import { AlertingSettings } from './AlertingSettings';

const options = createDefaultConfigOptions();

describe('AlertingSettings', () => {
  it('should render', () => {
    render(<AlertingSettings options={options} onOptionsChange={() => {}} />);
    expect(screen.getByText('Alerting')).toBeInTheDocument();
  });

  it('should update alerting settings', async () => {
    const onChange = jest.fn();
    render(<AlertingSettings options={options} onOptionsChange={onChange} />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  describe('Switch checked behavior', () => {
    describe('when options.jsonData.manageAlerts is unset', () => {
      it('uses the config default `true`', () => {
        const testOptions = createDefaultConfigOptions();
        testOptions.jsonData.manageAlerts = undefined;

        config.defaultDatasourceManageAlertsUiToggle = true;

        render(<AlertingSettings options={testOptions} onOptionsChange={() => {}} />);

        expect(screen.getByRole('switch')).toBeChecked();
      });

      it('uses the config default `false`', () => {
        const testOptions = createDefaultConfigOptions();
        testOptions.jsonData.manageAlerts = undefined;

        config.defaultDatasourceManageAlertsUiToggle = false;

        render(<AlertingSettings options={testOptions} onOptionsChange={() => {}} />);

        expect(screen.getByRole('switch')).not.toBeChecked();
      });
    });

    describe('when options.jsonData.manageAlerts is set', () => {
      it.each([true, false])('uses the manageAlerts value even when the config default is %s', (configDefault) => {
        const testOptions = createDefaultConfigOptions();
        testOptions.jsonData.manageAlerts = true;

        config.defaultDatasourceManageAlertsUiToggle = configDefault;

        render(<AlertingSettings options={testOptions} onOptionsChange={() => {}} />);

        expect(screen.getByRole('switch')).toBeChecked();
      });
    });
  });
});
