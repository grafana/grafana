import React from 'react';
import { mount } from 'enzyme';
import { CustomHeadersSettings, Props } from './CustomHeadersSettings';

const setup = (propOverrides?: object) => {
  const props: Props = {
    dataSourceConfig: {
      id: 4,
      orgId: 1,
      name: 'gdev-influxdb',
      type: 'influxdb',
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
      readOnly: true,
    },
    onChange: jest.fn(),
    ...propOverrides,
  };

  return mount(<CustomHeadersSettings {...props} />);
};

describe('Render', () => {
  it('should add a new header', () => {
    const wrapper = setup();
    const addButton = wrapper.find('Button').at(0);
    addButton.simulate('click', { preventDefault: () => {} });
    expect(wrapper.find('FormField').exists()).toBeTruthy();
    expect(wrapper.find('SecretFormField').exists()).toBeTruthy();
  });

  it('should remove a header', () => {
    const wrapper = setup({
      dataSourceConfig: {
        jsonData: {
          httpHeaderName1: 'X-Custom-Header',
        },
        secureJsonFields: {
          httpHeaderValue1: true,
        },
      },
    });
    const removeButton = wrapper.find('Button').find({ variant: 'destructive' });
    removeButton.simulate('click', { preventDefault: () => {} });
    expect(wrapper.find('FormField').exists()).toBeFalsy();
    expect(wrapper.find('SecretFormField').exists()).toBeFalsy();
  });

  it('should reset a header', () => {
    const wrapper = setup({
      dataSourceConfig: {
        jsonData: {
          httpHeaderName1: 'X-Custom-Header',
        },
        secureJsonFields: {
          httpHeaderValue1: true,
        },
      },
    });
    const resetButton = wrapper.find('button').at(0);
    resetButton.simulate('click', { preventDefault: () => {} });
    const { isConfigured } = wrapper.find('SecretFormField').props() as any;
    expect(isConfigured).toBeFalsy();
  });
});
