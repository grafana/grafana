import { act, render, screen } from '@testing-library/react';
import { shallow } from 'enzyme';
import React from 'react';
import selectEvent from 'react-select-event';

import { AwsAuthType } from '@grafana/aws-sdk';

import { setupMockedDataSource } from '../__mocks__/CloudWatchDataSource';

import { ConfigEditor, Props } from './ConfigEditor';

const ds = setupMockedDataSource();

const describeLogGroup = jest.fn().mockResolvedValue(['foo', 'bar']);

jest.mock('app/features/plugins/datasource_srv', () => ({
  getDatasourceSrv: () => ({
    loadDatasource: jest.fn().mockImplementation(() =>
      Promise.resolve({
        getRegions: jest.fn().mockResolvedValue([
          {
            label: 'ap-east-1',
            value: 'ap-east-1',
          },
        ]),
        describeLogGroup,
        getActualRegion: jest.fn().mockReturnValue('ap-east-1'),
        getList: jest.fn().mockImplementation(() => []),
      })
    ),
    getList: jest.fn().mockImplementation(() => []),
  }),
}));

jest.mock('./XrayLinkConfig', () => ({
  XrayLinkConfig: () => <></>,
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    put: jest.fn().mockResolvedValue({ datasource: ds.datasource }),
  }),
  setTemplateSrv: jest.fn(),
  config: {
    loginError: false,
    buildInfo: {
      version: 'v1.0',
      commit: '1',
      env: 'production',
      edition: 'Open Source',
    },
    licenseInfo: {
      stateInfo: '',
      licenseUrl: '',
    },
    appSubUrl: '',
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
    password: '',
    basicAuth: false,
    basicAuthPassword: '',
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

  it('should call describeLogGroups when multiselect isopened', async () => {
    // const wrapper = setup();
    // const logsSelect = wrapper.find({ label: 'Default Log Groups' });
    // expect(logsSelect.length).toEqual(1);
    // logsSelect.simulate('mouseDown', {
    //   button: 0,
    // });

    (window as any).grafanaBootData = {
      settings: {},
    };

    await act(async () => {
      render(<ConfigEditor {...props} />);
    });
    const multiselect = await screen.findByLabelText('Default Log Groups');
    //await selectOptionInTest(multiselect, 'foo');
    selectEvent.openMenu(multiselect);
    expect(await screen.findByText('foo')).toBeInTheDocument();
    expect(describeLogGroup).toHaveBeenCalled();
  });
});
