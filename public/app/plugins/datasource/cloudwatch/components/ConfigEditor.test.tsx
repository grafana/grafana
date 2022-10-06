import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import selectEvent from 'react-select-event';

import { AwsAuthType } from '@grafana/aws-sdk';
import { toOption } from '@grafana/data';
import { configureStore } from 'app/store/configureStore';

import { setupMockedDataSource } from '../__mocks__/CloudWatchDataSource';

import { ConfigEditor, Props } from './ConfigEditor';

jest.mock('app/features/plugins/datasource_srv', () => ({
  getDatasourceSrv: () => ({
    loadDatasource: jest.fn().mockResolvedValue({
      api: {
        describeLogGroups: jest.fn().mockResolvedValue(['logGroup-foo', 'logGroup-bar'].map(toOption)),
        getRegions: jest.fn().mockResolvedValue([
          {
            label: 'ap-east-1',
            value: 'ap-east-1',
          },
        ]),
      },
      getActualRegion: jest.fn().mockReturnValue('ap-east-1'),
      getVariables: jest.fn().mockReturnValue([]),
    }),
  }),
}));

jest.mock('./XrayLinkConfig', () => ({
  XrayLinkConfig: () => <></>,
}));

const putMock = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    put: putMock,
  }),
}));

const props: Props = {
  options: {
    id: 1,
    uid: 'z',
    orgId: 1,
    typeLogoUrl: '',
    name: 'CloudWatch',
    access: 'proxy',
    url: '',
    database: '',
    type: 'cloudwatch',
    typeName: 'Cloudwatch',
    user: '',
    basicAuth: false,
    basicAuthUser: '',
    isDefault: true,
    readOnly: false,
    withCredentials: false,
    secureJsonFields: {
      accessKey: false,
      secretKey: false,
    },
    jsonData: {
      assumeRoleArn: '',
      externalId: '',
      database: '',
      customMetricsNamespaces: '',
      authType: AwsAuthType.Keys,
      defaultRegion: 'us-east-2',
      timeField: '@timestamp',
    },
    secureJsonData: {
      secretKey: '',
      accessKey: '',
    },
  },
  onOptionsChange: jest.fn(),
};

const setup = (optionOverrides?: Partial<Props['options']>) => {
  const store = configureStore();
  const newProps = {
    ...props,
    options: {
      ...props.options,
      ...optionOverrides,
    },
  };

  render(
    <Provider store={store}>
      <ConfigEditor {...newProps} />
    </Provider>
  );
};

describe('Render', () => {
  beforeEach(() => {
    (window as any).grafanaBootData = {
      settings: {},
    };
    jest.resetAllMocks();
    putMock.mockImplementation(async () => ({ datasource: setupMockedDataSource().datasource }));
  });

  it('should render component without blowing up', () => {
    expect(() => setup()).not.toThrow();
  });

  it('should disable access key id field', () => {
    setup({
      secureJsonFields: {
        secretKey: true,
      },
    });
    expect(screen.getByPlaceholderText('Configured')).toBeDisabled();
  });

  it('should show credentials profile name field', () => {
    setup({
      jsonData: {
        authType: AwsAuthType.Credentials,
      },
    });
    expect(screen.getByLabelText('Credentials Profile Name')).toBeInTheDocument();
  });

  it('should show access key and secret access key fields', () => {
    setup({
      jsonData: {
        authType: AwsAuthType.Keys,
      },
    });
    expect(screen.getByLabelText('Access Key ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Secret Access Key')).toBeInTheDocument();
  });

  it('should show arn role field', () => {
    setup({
      jsonData: {
        authType: AwsAuthType.ARN,
      },
    });
    expect(screen.getByLabelText('Assume Role ARN')).toBeInTheDocument();
  });

  it('should load log groups when multiselect is opened', async () => {
    setup();
    const multiselect = await screen.findByLabelText('Log Groups');
    selectEvent.openMenu(multiselect);
    expect(await screen.findByText('logGroup-foo')).toBeInTheDocument();
  });
});
