import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataSourceHttpSettings } from './DataSourceHttpSettings';
import { type HttpSettingsProps } from './types';

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
      user: 'grafana',
      database: 'site',
      basicAuth: false,
      basicAuthUser: '',
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
    expect(screen.queryByText('SigV4 auth')).not.toBeInTheDocument();
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

  describe('Forwarded HTTP headers (proxy access)', () => {
    const proxyOverrides = {
      dataSourceConfig: {
        id: 4,
        uid: 'x',
        orgId: 1,
        name: 'gdev-mimir',
        type: 'prometheus',
        typeName: 'Prometheus',
        typeLogoUrl: '',
        access: 'proxy' as const,
        url: 'http://localhost:9090',
        user: '',
        database: '',
        basicAuth: false,
        basicAuthUser: '',
        withCredentials: false,
        isDefault: false,
        jsonData: {
          allowedHeaders: ['X-Scope-OrgID'],
        },
        secureJsonData: {},
        secureJsonFields: {},
        readOnly: false,
      },
    };

    it('renders the currently-configured allow-list entries when access is proxy', () => {
      setup(proxyOverrides);
      // The pre-configured value appears in the input as a tag, with a delete
      // affordance rendered for editing.
      expect(screen.getByText('X-Scope-OrgID')).toBeInTheDocument();
    });

    it('does not render the field when access is direct', () => {
      setup({
        ...proxyOverrides,
        dataSourceConfig: { ...proxyOverrides.dataSourceConfig, access: 'direct' as const },
      });
      expect(screen.queryByText('Forwarded HTTP headers')).not.toBeInTheDocument();
    });

    it('persists changes to allowedHeaders via onChange when the user adds a header', async () => {
      const user = userEvent.setup();
      const { onChange } = setup({
        ...proxyOverrides,
        dataSourceConfig: {
          ...proxyOverrides.dataSourceConfig,
          jsonData: { allowedHeaders: [] },
        },
      });

      // There are two TagsInput fields in proxy mode (keepCookies and
      // allowedHeaders); grab both textboxes and use the second one, which
      // belongs to "Forwarded HTTP headers" per DOM order.
      const inputs = screen.getAllByPlaceholderText(/new tag/i);
      expect(inputs.length).toBeGreaterThanOrEqual(2);
      const headerInput = inputs[inputs.length - 1];
      await user.type(headerInput, 'X-Scope-OrgID{enter}');

      const call = onChange.mock.calls.at(-1)?.[0];
      expect(call?.jsonData?.allowedHeaders).toEqual(['X-Scope-OrgID']);
    });
  });
});
