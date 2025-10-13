import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AwsAuthType } from '@grafana/aws-sdk';
import { PluginContextProvider, PluginMeta, PluginMetaInfo, PluginType } from '@grafana/data';

import {
  CloudWatchSettings,
  setupMockedDataSource,
  setupMockedTemplateService,
} from '../../__mocks__/CloudWatchDataSource';
import { CloudWatchDatasource } from '../../datasource';

import {
  ConfigEditor,
  Props,
  ARN_DEPRECATION_WARNING_MESSAGE,
  CREDENTIALS_AUTHENTICATION_WARNING_MESSAGE,
} from './ConfigEditor';

const datasource = new CloudWatchDatasource(CloudWatchSettings, setupMockedTemplateService());
const loadDataSourceMock = jest.fn();

jest.mock('./XrayLinkConfig', () => ({
  XrayLinkConfig: () => <></>,
}));

const putMock = jest.fn();
const getMock = jest.fn();
const mockAppEvents = {
  subscribe: () => ({ unsubscribe: jest.fn() }),
};
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    put: putMock,
    get: getMock,
  }),
  getDataSourceSrv: () => ({
    get: loadDataSourceMock,
  }),
  getAppEvents: () => mockAppEvents,
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    awsAssumeRoleEnabled: true,
    featureToggles: {
      cloudWatchCrossAccountQuerying: true,
    },
  },
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
    version: 2,
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
  const newProps = {
    ...props,
    options: {
      ...props.options,
      ...optionOverrides,
    },
  };
  const meta: PluginMeta = {
    ...newProps.options,
    id: 'cloudwatch',
    type: PluginType.datasource,
    info: {} as PluginMetaInfo,
    module: '',
    baseUrl: '',
  };

  return render(
    <PluginContextProvider meta={meta}>
      <ConfigEditor {...newProps} />
    </PluginContextProvider>
  );
};

describe('Render', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    putMock.mockImplementation(async () => ({ datasource: setupMockedDataSource().datasource }));
    getMock.mockImplementation(async () => ({ datasource: setupMockedDataSource().datasource }));
    loadDataSourceMock.mockResolvedValue(datasource);
    datasource.resources.getRegions = jest.fn().mockResolvedValue([
      {
        label: 'ap-east-1',
        value: 'ap-east-1',
      },
    ]);
    datasource.getActualRegion = jest.fn().mockReturnValue('ap-east-1');
    datasource.getVariables = jest.fn().mockReturnValue([]);
  });

  it('it should disable access key id field when the datasource has been previously configured', async () => {
    setup({
      secureJsonFields: {
        secretKey: true,
      },
    });
    await waitFor(async () => expect(screen.getByPlaceholderText('Configured')).toBeDisabled());
  });

  it('should show credentials profile name field', async () => {
    setup({
      jsonData: {
        authType: AwsAuthType.Credentials,
      },
    });
    await waitFor(async () => expect(screen.getByText('Credentials Profile Name')).toBeInTheDocument());
  });

  it('should show a warning if `credentials` auth type is used without a profile or database configured', async () => {
    setup({
      jsonData: {
        authType: AwsAuthType.Credentials,
        profile: undefined,
        database: undefined,
      },
    });
    await waitFor(async () => expect(screen.getByText(CREDENTIALS_AUTHENTICATION_WARNING_MESSAGE)).toBeInTheDocument());
  });

  it('should not show a warning if `credentials` auth type is used and a profile is configured', async () => {
    setup({
      jsonData: {
        authType: AwsAuthType.Credentials,
        profile: 'profile',
        database: undefined,
      },
    });
    await waitFor(async () =>
      expect(screen.queryByText(CREDENTIALS_AUTHENTICATION_WARNING_MESSAGE)).not.toBeInTheDocument()
    );
  });

  it('should not show a warning if `credentials` auth type is used and a database is configured', async () => {
    setup({
      jsonData: {
        authType: AwsAuthType.Credentials,
        profile: undefined,
        database: 'database',
      },
    });
    await waitFor(async () =>
      expect(screen.queryByText(CREDENTIALS_AUTHENTICATION_WARNING_MESSAGE)).not.toBeInTheDocument()
    );
  });

  it('should show access key and secret access key fields when the datasource has not been configured before', async () => {
    setup({
      jsonData: {
        authType: AwsAuthType.Keys,
      },
    });
    await waitFor(async () => {
      expect(screen.getByLabelText('Access Key ID')).toBeInTheDocument();
      expect(screen.getByLabelText('Secret Access Key')).toBeInTheDocument();
    });
  });

  it('should show arn role field', async () => {
    setup({
      jsonData: {
        authType: AwsAuthType.ARN,
      },
    });
    await waitFor(async () => expect(screen.getByText('Assume Role ARN')).toBeInTheDocument());
  });

  it('should display namespace field', async () => {
    setup();
    await waitFor(async () => expect(screen.getByText('Namespaces of Custom Metrics')).toBeInTheDocument());
  });

  it('should show a deprecation warning if `arn` auth type is used', async () => {
    setup({
      jsonData: {
        authType: AwsAuthType.ARN,
      },
    });
    await waitFor(async () => expect(screen.getByText(ARN_DEPRECATION_WARNING_MESSAGE)).toBeInTheDocument());
  });

  it('should display log group selector field', async () => {
    setup();
    await waitFor(async () => expect(screen.getByText('Select log groups')).toBeInTheDocument());
  });

  it('should only display the first two default log groups and show all of them when clicking "Show all" button', async () => {
    setup({
      version: 2,
      jsonData: {
        logGroups: [
          { arn: 'arn:aws:logs:us-east-2:123456789012:log-group:logGroup-foo:*', name: 'logGroup-foo' },
          { arn: 'arn:aws:logs:us-east-2:123456789012:log-group:logGroup-bar:*', name: 'logGroup-bar' },
          { arn: 'arn:aws:logs:us-east-2:123456789012:log-group:logGroup-baz:*', name: 'logGroup-baz' },
        ],
      },
    });
    await waitFor(async () => {
      expect(await screen.getByText('logGroup-foo')).toBeInTheDocument();
      expect(await screen.getByText('logGroup-bar')).toBeInTheDocument();
      expect(await screen.queryByText('logGroup-baz')).not.toBeInTheDocument();

      await userEvent.click(screen.getByText('Show all'));

      expect(await screen.getByText('logGroup-baz')).toBeInTheDocument();
    });
  });

  it('should load the data source if it was saved before', async () => {
    const SAVED_VERSION = 2;
    setup({ version: SAVED_VERSION });
    await waitFor(async () => expect(loadDataSourceMock).toHaveBeenCalled());
  });

  it('should not load the data source if it wasnt saved before', async () => {
    const SAVED_VERSION = undefined;
    setup({ version: SAVED_VERSION });
    await waitFor(async () => expect(loadDataSourceMock).not.toHaveBeenCalled());
  });

  it('should show error message if Select log group button is clicked when data source is never saved', async () => {
    setup({ version: 1 });
    await waitFor(() => expect(screen.getByText('Select log groups')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Select log groups'));
    await waitFor(() =>
      expect(screen.getByText('You need to save the data source before adding log groups.')).toBeInTheDocument()
    );
  });

  it('should show error message if Select log group button is clicked when data source is saved before but have unsaved changes', async () => {
    const SAVED_VERSION = 3;
    const newProps = {
      ...props,
      options: {
        ...props.options,
        version: SAVED_VERSION,
      },
    };
    const meta: PluginMeta = {
      ...newProps.options,
      id: 'cloudwatch',
      type: PluginType.datasource,
      info: {} as PluginMetaInfo,
      module: '',
      baseUrl: '',
    };

    const { rerender } = render(
      <PluginContextProvider meta={meta}>
        <ConfigEditor {...newProps} />
      </PluginContextProvider>
    );
    await waitFor(() => expect(screen.getByText('Select log groups')).toBeInTheDocument());
    const rerenderProps = {
      ...newProps,
      options: {
        ...newProps.options,
        jsonData: {
          ...newProps.options.jsonData,
          authType: AwsAuthType.Default,
        },
      },
    };
    rerender(
      <PluginContextProvider meta={meta}>
        <ConfigEditor {...rerenderProps} />
      </PluginContextProvider>
    );
    await waitFor(() => expect(screen.getByText('AWS SDK Default')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Select log groups'));
    await waitFor(() =>
      expect(
        screen.getByText(
          'You have unsaved connection detail changes. You need to save the data source before adding log groups.'
        )
      ).toBeInTheDocument()
    );
  });

  it('should open log group selector if Select log group button is clicked when data source has saved changes', async () => {
    const newProps = {
      ...props,
      options: {
        ...props.options,
        version: 1,
      },
    };
    const meta: PluginMeta = {
      ...newProps.options,
      id: 'cloudwatch',
      type: PluginType.datasource,
      info: {} as PluginMetaInfo,
      module: '',
      baseUrl: '',
    };
    const { rerender } = render(
      <PluginContextProvider meta={meta}>
        <ConfigEditor {...newProps} />
      </PluginContextProvider>
    );
    await waitFor(() => expect(screen.getByText('Select log groups')).toBeInTheDocument());
    const rerenderProps = {
      ...newProps,
      options: {
        ...newProps.options,
        version: 2,
      },
    };
    rerender(
      <PluginContextProvider meta={meta}>
        <ConfigEditor {...rerenderProps} />
      </PluginContextProvider>
    );
    await userEvent.click(screen.getByText('Select log groups'));
    await waitFor(() => expect(screen.getByText('Log group name prefix')).toBeInTheDocument());
  });
});
