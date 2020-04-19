import React from 'react';
import { shallow } from 'enzyme';
import ConfigEditor, { Props } from './ConfigEditor';

jest.mock('app/features/plugins/datasource_srv', () => ({
  getDatasourceSrv: () => ({
    loadDatasource: jest.fn().mockImplementation(() =>
      Promise.resolve({
        getRegions: jest.fn().mockReturnValue([
          {
            label: 'ap-east-1',
            value: 'ap-east-1',
          },
        ]),
      })
    ),
  }),
}));

const setup = (propOverrides?: object) => {
  const props: Props = {
    options: {
      id: 1,
      orgId: 1,
      typeLogoUrl: '',
      name: 'CloudWatch',
      access: 'proxy',
      url: '',
      database: '',
      type: 'cloudwatch',
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
        customMetricsNamespaces: '',
        authType: 'keys',
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

  Object.assign(props, propOverrides);

  return shallow(<ConfigEditor {...props} />);
};

describe('Render', () => {
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

  it('should should show credentials profile name field', () => {
    const wrapper = setup({
      jsonData: {
        authType: 'credentials',
      },
    });
    expect(wrapper).toMatchSnapshot();
  });

  it('should should show access key and secret access key fields', () => {
    const wrapper = setup({
      jsonData: {
        authType: 'keys',
      },
    });
    expect(wrapper).toMatchSnapshot();
  });

  it('should should show arn role field', () => {
    const wrapper = setup({
      jsonData: {
        authType: 'arn',
      },
    });
    expect(wrapper).toMatchSnapshot();
  });
});
