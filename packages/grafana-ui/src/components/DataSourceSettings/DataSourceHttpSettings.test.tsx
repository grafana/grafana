import { render, screen } from '@testing-library/react';
import React from 'react';

import { DataSourceHttpSettings } from '@grafana/ui';

import { HttpSettingsProps } from './types';

const setup = (propOverrides?: object) => {
  const onChange = jest.fn();
  const props: HttpSettingsProps = {
    dataSourceConfig: {
      id: 4,
      uid: 'x',
      orgId: 1,
      name: 'gdev-influxdb',
      type: 'influxdb',
      typeName: 'Influxdb',
      typeLogoUrl: '',
      access: 'direct',
      url: 'http://localhost:8086',
      password: '',
      user: 'grafana',
      database: 'site',
      basicAuth: false,
      basicAuthUser: '',
      basicAuthPassword: '',
      withCredentials: false,
      isDefault: false,
      jsonData: {
        timeInterval: '15s',
        httpMode: 'GET',
        keepCookies: ['cookie1', 'cookie2'],
      },
      secureJsonData: {
        password: true,
      },
      secureJsonFields: {},
      readOnly: true,
    },
    onChange,
    ...propOverrides,
    defaultUrl: '',
  };

  render(<DataSourceHttpSettings {...props} />);
  return { onChange };
};

const SIGV4TestEditor = (props: { renderText: string }) => {
  return <>{props.renderText}</>;
};

describe('DataSourceHttpSettings', () => {
  it('should render SIGV4 label if SIGV4 is enabled', () => {
    setup({ sigV4AuthToggleEnabled: true });
    expect(screen.getByLabelText('SigV4 auth')).toBeInTheDocument();
  });

  it('should not render SIGV4 label if SIGV4 is not enabled', () => {
    setup({ sigV4AuthToggleEnabled: false });
    expect(screen.queryByText('SigV4 auth')).toBeNull();
  });

  it('should render SIGV4 editor if provided and SIGV4 is enabled', () => {
    const expectedText = 'sigv4-test-editor';
    setup({
      sigV4AuthToggleEnabled: true,
      renderSigV4Editor: <SIGV4TestEditor renderText={expectedText}></SIGV4TestEditor>,
      dataSourceConfig: {
        jsonData: {
          sigV4Auth: true,
        },
      },
    });
    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });
});
