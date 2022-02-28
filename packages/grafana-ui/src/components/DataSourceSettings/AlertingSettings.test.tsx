import { AlertingDataSourceJsonData } from '@grafana/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ComponentProps } from 'react';
import { AlertingSettings } from './AlertingSettings';

type AlertingSettingsOptions = ComponentProps<typeof AlertingSettings>['options'];

const dataSourceOptions: AlertingSettingsOptions = {
  id: 1,
  uid: 'prom-ds',
  orgId: 1,
  name: 'gdev-prometheus',
  type: 'prometheus',
  typeName: 'Prometheus',
  typeLogoUrl: '',
  access: 'server',
  url: 'http://localhost:9090',
  password: '',
  user: 'grafana',
  database: 'site',
  basicAuth: false,
  basicAuthUser: '',
  basicAuthPassword: '',
  withCredentials: false,
  isDefault: false,
  jsonData: {},
  secureJsonData: {},
  secureJsonFields: {},
  readOnly: true,
};

describe('AlertingSettings test', () => {
  describe('Custom ruler url', () => {
    it('Should display custom ruler url section when manage alerts and custom ruler url enabled', async () => {
      // Arrange
      const options: AlertingSettingsOptions = { ...dataSourceOptions, jsonData: { manageAlerts: true } };

      // Act
      render(
        <AlertingSettings<AlertingDataSourceJsonData>
          alertmanagerDataSources={[]}
          options={options}
          sigV4AuthEnabled={false}
          onOptionsChange={() => null}
        />
      );

      const urlSwitch = screen.getByText('Custom ruler URL');
      userEvent.click(urlSwitch);

      const rulerSettingsSection = screen.getByTestId('custom-ruler-url-settings-section');

      // Assert
      expect(rulerSettingsSection).toBeInTheDocument();
      expect(screen.getByText('Ruler')).toBeInTheDocument();
      expect(screen.getByText('Auth')).toBeInTheDocument();
    });

    it('Should push ruler config to the jsonData object', async () => {
      // Arrange
      const options: AlertingSettingsOptions = { ...dataSourceOptions, jsonData: { manageAlerts: true } };
      const mockOnOptionsChange = jest.fn<void, [AlertingSettingsOptions]>();

      // Act
      render(
        <AlertingSettings<AlertingDataSourceJsonData>
          alertmanagerDataSources={[]}
          options={options}
          sigV4AuthEnabled={false}
          onOptionsChange={mockOnOptionsChange}
        />
      );

      const customRulerUrlSwitch = screen.getByText('Custom ruler URL');
      userEvent.click(customRulerUrlSwitch);

      const urlInput = screen.getByLabelText('Datasource HTTP settings url');

      userEvent.paste(urlInput, 'http://localhost:1234');

      // Assert
      expect(mockOnOptionsChange).toBeCalledWith<[AlertingSettingsOptions]>({
        ...options,
        jsonData: {
          manageAlerts: true,
          ruler: {
            url: 'http://localhost:1234',
            basicAuth: false,
            withCredentials: false,
            basicAuthUser: '',
            basicAuthPassword: '',
          },
        },
      });
    });
  });
});
