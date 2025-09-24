import { render, screen } from '@testing-library/react';

import { AlertingSettings, Props, AlertingConfig } from './AlertingSettings';

const setup = () => {
  const onOptionsChange = jest.fn();
  const props: Props<AlertingConfig> = {
    options: {
      id: 4,
      uid: 'x',
      orgId: 1,
      name: 'test',
      type: 'test',
      typeName: 'test',
      typeLogoUrl: '',
      access: 'direct',
      url: 'http://localhost:8086',
      user: 'grafana',
      database: 'site',
      basicAuth: false,
      basicAuthUser: '',
      withCredentials: false,
      isDefault: false,
      jsonData: {},
      secureJsonData: {
        password: true,
      },
      secureJsonFields: {},
      readOnly: true,
    },
    onOptionsChange,
  };

  render(<AlertingSettings {...props} />);
};

describe('Alerting Settings', () => {
  //see https://github.com/grafana/grafana/issues/51417
  it('should not show the option to select alertmanager data sources', () => {
    setup();
    expect(screen.queryByText('Alertmanager data source')).not.toBeInTheDocument();
  });

  it('should show the option to manager alerts', () => {
    setup();
    expect(screen.getByText('Manage alert rules in Alerting UI')).toBeVisible();
  });
});
