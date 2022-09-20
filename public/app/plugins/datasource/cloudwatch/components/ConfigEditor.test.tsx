import { screen } from '@testing-library/react';
import React from 'react';
import selectEvent from 'react-select-event';
import { render } from 'test/redux-rtl';

import { AwsAuthType } from '@grafana/aws-sdk';

import { setupMockedDataSource } from '../__mocks__/CloudWatchDataSource';

import { ConfigEditor, Props } from './ConfigEditor';

declare global {
  interface Window {
    grafanaBootData?: any;
  }
}

jest.mock('app/features/plugins/datasource_srv', () => ({
  getDatasourceSrv: () => ({
    loadDatasource: jest.fn().mockResolvedValue({
      api: {
        getRegions: jest.fn().mockResolvedValue([
          {
            label: 'ap-east-1',
            value: 'ap-east-1',
          },
        ]),
      },
      getActualRegion: jest.fn().mockReturnValue('ap-east-1'),
      getVariables: jest.fn().mockReturnValue([]),
      logsQueryRunner: {
        describeLogGroups: jest.fn().mockResolvedValue(['logGroup-foo', 'logGroup-bar']),
      },
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
  const mergedOptions = { ...props.options, ...optionOverrides };
  return render(<ConfigEditor onOptionsChange={props.onOptionsChange} options={mergedOptions} />);
};

describe('Render', () => {
  let oldBootData = {};

  beforeAll(() => {
    oldBootData = window.grafanaBootData;
    window.grafanaBootData = {
      settings: {
        awsAllowedAuthProviders: ['keys'],
        awsAssumeRoleEnabled: true,
      },
    };
  });

  afterAll(() => {
    window.grafanaBootData = oldBootData;
  });

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.resetAllMocks();
    putMock.mockImplementation(async () => ({ datasource: setupMockedDataSource().datasource }));
  });

  it('should render component', () => {
    expect(() => setup()).not.toThrow();
  });

  it('should disable access key id field', () => {
    setup({
      secureJsonFields: {
        secretKey: true,
      },
    });
    expect((screen.getByText('Secret Access Key').nextSibling as HTMLElement).querySelector('input')).toBeDisabled();
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
        authType: AwsAuthType.Default,
      },
    });

    expect(screen.getByLabelText('Assume Role ARN')).toBeInTheDocument();
  });

  it('should load log groups when multiselect is opened', async () => {
    render(<ConfigEditor {...props} />);
    const multiselect = await screen.findByLabelText('Log Groups');
    selectEvent.openMenu(multiselect);
    expect(await screen.findByText('logGroup-foo')).toBeInTheDocument();
  });
});
