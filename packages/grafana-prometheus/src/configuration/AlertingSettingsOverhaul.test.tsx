import { render } from '@testing-library/react';

import { config } from '@grafana/runtime';

import { createDefaultConfigOptions } from '../test/__mocks__/datasource';

import { AlertingSettingsOverhaul } from './AlertingSettingsOverhaul';

describe(AlertingSettingsOverhaul.name, () => {
  describe('Switch checked behavior', () => {
    describe('when options.jsonData.manageAlerts is unset', () => {
      it('uses the config default `true`', () => {
        const options = createDefaultConfigOptions();
        options.jsonData.manageAlerts = undefined;

        config.defaultDatasourceManageAlertsUiToggle = true;

        const { getByRole } = render(<AlertingSettingsOverhaul onOptionsChange={() => {}} options={options} />);

        expect(getByRole('switch')).toBeChecked();
      });

      it('uses the config default `false`', () => {
        const options = createDefaultConfigOptions();
        options.jsonData.manageAlerts = undefined;

        config.defaultDatasourceManageAlertsUiToggle = false;

        const { getByRole } = render(<AlertingSettingsOverhaul onOptionsChange={() => {}} options={options} />);

        expect(getByRole('switch')).not.toBeChecked();
      });
    });

    describe('when options.jsonData.manageAlerts is set', () => {
      it.each([true, false])('uses the manageAlerts value even when the config default is %s', (configDefault) => {
        const options = createDefaultConfigOptions();
        options.jsonData.manageAlerts = true;

        config.defaultDatasourceManageAlertsUiToggle = configDefault;

        const { getByRole } = render(<AlertingSettingsOverhaul onOptionsChange={() => {}} options={options} />);

        expect(getByRole('switch')).toBeChecked();
      });
    });
  });
});
