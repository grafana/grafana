import React from 'react';
import { shallow } from 'enzyme';
import ConfigEditor, { Props } from './ConfigEditor';

const setup = (propOverrides?: object) => {
  const props: Props = {
    options: {
      id: 21,
      orgId: 1,
      name: 'InfluxDB-3',
      type: 'influxdb',
      typeLogoUrl: '',
      access: 'proxy',
      url: '',
      password: '',
      user: '',
      database: '',
      basicAuth: false,
      basicAuthUser: '',
      basicAuthPassword: '',
      withCredentials: false,
      isDefault: false,
      jsonData: {
        httpMode: 'POST',
        timeInterval: '4',
      },
      secureJsonFields: {},
      version: 1,
      readOnly: false,
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

  it('should disable basic auth password input', () => {
    const wrapper = setup({
      secureJsonFields: {
        basicAuthPassword: true,
      },
    });
    expect(wrapper).toMatchSnapshot();
  });

  it('should hide white listed cookies input when browser access chosen', () => {
    const wrapper = setup({
      access: 'direct',
    });
    expect(wrapper).toMatchSnapshot();
  });

  it('should hide basic auth fields when switch off', () => {
    const wrapper = setup({
      basicAuth: false,
    });
    expect(wrapper).toMatchSnapshot();
  });
});
