import { render, screen } from '@testing-library/react';

import { InfluxVersion } from '../../../types';

import ConfigEditor, { Props } from './ConfigEditor';

jest.mock('lodash', () => {
  const uniqueId = (prefix: string) => `${prefix}42`;

  const orig = jest.requireActual('lodash');

  return {
    ...orig,
    uniqueId,
  };
});

const setup = (optionOverrides?: object) => {
  const props: Props = {
    options: {
      id: 21,
      uid: 'z',
      orgId: 1,
      name: 'InfluxDB-3',
      type: 'influxdb',
      typeName: 'Influx',
      typeLogoUrl: '',
      access: 'proxy',
      url: '',
      user: '',
      database: '',
      basicAuth: false,
      basicAuthUser: '',
      withCredentials: false,
      isDefault: false,
      jsonData: {
        httpMode: 'POST',
        timeInterval: '4',
        showTagTime: '3h',
      },
      secureJsonFields: {},
      version: 1,
      readOnly: false,
      ...optionOverrides,
    },
    onOptionsChange: jest.fn(),
  };

  return render(<ConfigEditor {...props} />);
};

describe('ConfigEditor', () => {
  it('should render without throwing an error', () => {
    expect(() => setup()).not.toThrow();
  });

  it('should disable basic auth password input', () => {
    setup({
      basicAuth: true,
      secureJsonFields: {
        basicAuthPassword: true,
      },
    });
    expect(screen.getByDisplayValue('configured')).toBeInTheDocument();
  });

  it('influxQL options should show up if version is not defined', () => {
    setup({});
    expect(screen.queryByLabelText('Password')).toBeInTheDocument();
  });

  it('influxQL options should show up if version is ill-defined', () => {
    setup({
      jsonData: {
        version: 'influx',
      },
    });
    expect(screen.queryByLabelText('Password')).toBeInTheDocument();
  });

  it('influxQL options should not show up if version is defined as flux', () => {
    setup({
      jsonData: {
        version: InfluxVersion.Flux,
      },
    });
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Token')).toBeInTheDocument();
  });

  it('should hide white listed cookies input when browser access chosen', () => {
    setup({
      access: 'direct',
    });
    expect(screen.queryByLabelText('Allowed cookies')).not.toBeInTheDocument();
  });

  it('should hide basic auth fields when switch off', () => {
    setup({
      basicAuth: false,
    });
    expect(screen.queryByRole('heading', { name: 'Basic Auth Details' })).not.toBeInTheDocument();
  });
});
