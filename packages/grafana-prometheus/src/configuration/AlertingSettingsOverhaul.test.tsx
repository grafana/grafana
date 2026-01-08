import { render } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';

import { createDefaultConfigOptions } from '../test/mocks/datasource';

import { AlertingSettingsOverhaul } from './AlertingSettingsOverhaul';

describe(AlertingSettingsOverhaul.name, () => {
  describe('Manage Alerts toggle', () => {
    describe('when options.jsonData.manageAlerts is unset', () => {
      it('uses the config default `true`', () => {
        const options = createDefaultConfigOptions();
        options.jsonData.manageAlerts = undefined;

        config.defaultDatasourceManageAlertsUiToggle = true;

        const { container } = render(<AlertingSettingsOverhaul onOptionsChange={() => {}} options={options} />);

        const manageAlertsToggle = container.querySelector(
          `#${selectors.components.DataSource.Prometheus.configPage.manageAlerts}`
        );
        expect(manageAlertsToggle).toBeChecked();
      });

      it('uses the config default `false`', () => {
        const options = createDefaultConfigOptions();
        options.jsonData.manageAlerts = undefined;

        config.defaultDatasourceManageAlertsUiToggle = false;

        const { container } = render(<AlertingSettingsOverhaul onOptionsChange={() => {}} options={options} />);

        const manageAlertsToggle = container.querySelector(
          `#${selectors.components.DataSource.Prometheus.configPage.manageAlerts}`
        );
        expect(manageAlertsToggle).not.toBeChecked();
      });
    });

    describe('when options.jsonData.manageAlerts is set', () => {
      it.each([true, false])('uses the manageAlerts value even when the config default is %s', (configDefault) => {
        const options = createDefaultConfigOptions();
        options.jsonData.manageAlerts = true;

        config.defaultDatasourceManageAlertsUiToggle = configDefault;

        const { container } = render(<AlertingSettingsOverhaul onOptionsChange={() => {}} options={options} />);

        const manageAlertsToggle = container.querySelector(
          `#${selectors.components.DataSource.Prometheus.configPage.manageAlerts}`
        );
        expect(manageAlertsToggle).toBeChecked();
      });
    });
  });

  describe('Recording Rules Target toggle', () => {
    describe('when options.jsonData.allowAsRecordingRulesTarget is unset', () => {
      it('defaults to `true` (enabled)', () => {
        const options = createDefaultConfigOptions();
        options.jsonData.allowAsRecordingRulesTarget = undefined;

        const { container } = render(<AlertingSettingsOverhaul onOptionsChange={() => {}} options={options} />);

        const recordingRulesTargetToggle = container.querySelector(
          `#${selectors.components.DataSource.Prometheus.configPage.allowAsRecordingRulesTarget}`
        );
        expect(recordingRulesTargetToggle).toBeChecked();
      });
    });

    describe('when options.jsonData.allowAsRecordingRulesTarget is set', () => {
      it.each([true, false])('uses the allowAsRecordingRulesTarget value %s', (value) => {
        const options = createDefaultConfigOptions();
        options.jsonData.allowAsRecordingRulesTarget = value;

        const { container } = render(<AlertingSettingsOverhaul onOptionsChange={() => {}} options={options} />);

        const recordingRulesTargetToggle = container.querySelector(
          `#${selectors.components.DataSource.Prometheus.configPage.allowAsRecordingRulesTarget}`
        );

        if (value) {
          expect(recordingRulesTargetToggle).toBeChecked();
        } else {
          expect(recordingRulesTargetToggle).not.toBeChecked();
        }
      });
    });
  });
});
