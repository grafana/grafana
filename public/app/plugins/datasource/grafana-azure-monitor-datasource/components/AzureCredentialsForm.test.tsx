import React from 'react';
import { shallow } from 'enzyme';
import AzureCredentialsForm, { Props } from './AzureCredentialsForm';
import { LegacyForms, Button } from '@grafana/ui';
const { Input } = LegacyForms;

const setup = (propsFunc?: (props: Props) => Props) => {
  let props: Props = {
    managedIdentityEnabled: false,
    credentials: {
      authType: 'clientsecret',
      azureCloud: 'azuremonitor',
      tenantId: 'e7f3f661-a933-3h3f-0294-31c4f962ec48',
      clientId: '34509fad-c0r9-45df-9e25-f1ee34af6900',
      clientSecret: undefined,
      defaultSubscriptionId: '44987801-6nn6-49he-9b2d-9106972f9789',
    },
    azureCloudOptions: [
      { value: 'azuremonitor', label: 'Azure' },
      { value: 'govazuremonitor', label: 'Azure US Government' },
      { value: 'germanyazuremonitor', label: 'Azure Germany' },
      { value: 'chinaazuremonitor', label: 'Azure China' },
    ],
    onCredentialsChange: jest.fn(),
    getSubscriptions: jest.fn(),
  };

  if (propsFunc) {
    props = propsFunc(props);
  }

  return shallow(<AzureCredentialsForm {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();
    expect(wrapper).toMatchSnapshot();
  });

  it('should disable azure monitor secret input', () => {
    const wrapper = setup((props) => ({
      ...props,
      credentials: {
        authType: 'clientsecret',
        azureCloud: 'azuremonitor',
        tenantId: 'e7f3f661-a933-3h3f-0294-31c4f962ec48',
        clientId: '34509fad-c0r9-45df-9e25-f1ee34af6900',
        clientSecret: Symbol(),
      },
    }));
    expect(wrapper).toMatchSnapshot();
  });

  it('should enable azure monitor load subscriptions button', () => {
    const wrapper = setup((props) => ({
      ...props,
      credentials: {
        authType: 'clientsecret',
        azureCloud: 'azuremonitor',
        tenantId: 'e7f3f661-a933-3h3f-0294-31c4f962ec48',
        clientId: '34509fad-c0r9-45df-9e25-f1ee34af6900',
        clientSecret: 'e7f3f661-a933-4b3f-8176-51c4f982ec48',
      },
    }));
    expect(wrapper).toMatchSnapshot();
  });

  describe('when disabled', () => {
    it('should disable inputs', () => {
      const wrapper = setup((props) => ({
        ...props,
        disabled: true,
      }));
      const inputs = wrapper.find(Input);
      expect(inputs.length).toBeGreaterThan(1);
      inputs.forEach((input) => {
        expect(input.prop('disabled')).toBe(true);
      });
    });

    it('should remove buttons', () => {
      const wrapper = setup((props) => ({
        ...props,
        disabled: true,
      }));
      expect(wrapper.find(Button).exists()).toBe(false);
    });
  });
});
