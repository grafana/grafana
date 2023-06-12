import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';

import { AwsAuthType } from '@grafana/aws-sdk';
import { configureStore } from 'app/store/configureStore';

import { CloudWatchSettings, setupMockedDataSource } from '../__mocks__/CloudWatchDataSource';
import { CloudWatchDatasource } from '../datasource';

import { ConfigEditor, Props } from './ConfigEditor';

const datasource = new CloudWatchDatasource(CloudWatchSettings);
const loadDataSourceMock = jest.fn();
jest.mock('app/features/plugins/datasource_srv', () => ({
  getDatasourceSrv: () => ({
    loadDatasource: loadDataSourceMock,
  }),
}));

jest.mock('./XrayLinkConfig', () => ({
  XrayLinkConfig: () => <></>,
}));

const putMock = jest.fn();
const getMock = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    put: putMock,
    get: getMock,
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
    await waitFor(async () => expect(screen.getByLabelText('Credentials Profile Name')).toBeInTheDocument());
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
    await waitFor(async () => expect(screen.getByLabelText('Assume Role ARN')).toBeInTheDocument());
  });

  it('should display log group selector field', async () => {
    setup();
    await waitFor(async () => expect(await screen.getByText('Select log groups')).toBeInTheDocument());
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
    const newProps = {
      ...props,
      options: {
        ...props.options,
        version: SAVED_VERSION,
      },
    };

    render(<ConfigEditor {...newProps} />);
    await waitFor(async () => expect(loadDataSourceMock).toHaveBeenCalled());
  });

  it('should not load the data source if it wasnt saved before', async () => {
    const SAVED_VERSION = undefined;
    const newProps = {
      ...props,
      options: {
        ...props.options,
        version: SAVED_VERSION,
      },
    };

    render(<ConfigEditor {...newProps} />);
    await waitFor(async () => expect(loadDataSourceMock).not.toHaveBeenCalled());
  });

  it('should show error message if Select log group button is clicked when data source is never saved', async () => {
    const SAVED_VERSION = undefined;
    const newProps = {
      ...props,
      options: {
        ...props.options,
        version: SAVED_VERSION,
      },
    };

    render(<ConfigEditor {...newProps} />);

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
    const { rerender } = render(<ConfigEditor {...newProps} />);
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
    rerender(<ConfigEditor {...rerenderProps} />);
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
    const SAVED_VERSION = undefined;
    const newProps = {
      ...props,
      options: {
        ...props.options,
        version: SAVED_VERSION,
      },
    };
    const { rerender } = render(<ConfigEditor {...newProps} />);
    await waitFor(() => expect(screen.getByText('Select log groups')).toBeInTheDocument());
    const rerenderProps = {
      ...newProps,
      options: {
        ...newProps.options,
        version: 1,
      },
    };
    rerender(<ConfigEditor {...rerenderProps} />);
    await userEvent.click(screen.getByText('Select log groups'));
    await waitFor(() => expect(screen.getByText('Log group name prefix')).toBeInTheDocument());
  });
});
