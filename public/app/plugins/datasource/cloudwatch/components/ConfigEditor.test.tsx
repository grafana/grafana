import { render, screen } from '@testing-library/react';
import { shallow } from 'enzyme';
import React from 'react';
import selectEvent from 'react-select-event';

import { AwsAuthType } from '@grafana/aws-sdk';
import { toOption } from '@grafana/data';

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

const setup = (propOverrides?: object) => {
  const newProps = { ...props, ...propOverrides };

  return shallow(<ConfigEditor {...newProps} />);
};

describe('Render', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    putMock.mockImplementation(async () => ({ datasource: setupMockedDataSource().datasource }));
  });
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should disable access key id field', () => {
    const wrapper = setup({
      secureJsonFields: {
        secretKey: true,
      },
    });
    expect(wrapper).toMatchSnapshot();
  });

  it('should show credentials profile name field', () => {
    const wrapper = setup({
      jsonData: {
        authType: 'credentials',
      },
    });
    expect(wrapper).toMatchSnapshot();
  });

  it('should show access key and secret access key fields', () => {
    const wrapper = setup({
      jsonData: {
        authType: 'keys',
      },
    });
    expect(wrapper).toMatchSnapshot();
  });

  it('should show arn role field', () => {
    const wrapper = setup({
      jsonData: {
        authType: 'arn',
      },
    });
    expect(wrapper).toMatchSnapshot();
  });

  it('should load log groups when multiselect is opened', async () => {
    (window as any).grafanaBootData = {
      settings: {},
    };

    render(<ConfigEditor {...props} />);
    const multiselect = await screen.findByLabelText('Log Groups');
    selectEvent.openMenu(multiselect);
    expect(await screen.findByText('logGroup-foo')).toBeInTheDocument();
  });
});
