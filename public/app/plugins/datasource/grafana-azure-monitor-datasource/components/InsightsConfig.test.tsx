import React from 'react';
import { shallow } from 'enzyme';
import InsightsConfig, { Props } from './InsightsConfig';
import { Button, LegacyForms } from '@grafana/ui';
const { Input } = LegacyForms;

const setup = (propOverrides?: object) => {
  const props: Props = {
    options: {
      id: 21,
      uid: 'x',
      orgId: 1,
      name: 'Azure Monitor-10-10',
      type: 'grafana-azure-monitor-datasource',
      typeLogoUrl: '',
      typeName: 'Azure',
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
      secureJsonFields: {},
      jsonData: {
        cloudName: '',
        subscriptionId: '',
      },
      secureJsonData: {},
      version: 1,
      readOnly: false,
    },
    onUpdateJsonDataOption: jest.fn(),
    onUpdateSecureJsonDataOption: jest.fn(),
    onResetOptionKey: jest.fn(),
  };

  Object.assign(props, propOverrides);

  return shallow(<InsightsConfig {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should disable insights api key input', () => {
    const wrapper = setup({
      options: {
        secureJsonFields: {
          appInsightsApiKey: true,
        },
        jsonData: {
          appInsightsAppId: 'cddcc020-2c94-460a-a3d0-df3147ffa792',
        },
        secureJsonData: {
          appInsightsApiKey: 'e7f3f661-a933-4b3f-8176-51c4f982ec48',
        },
      },
    });
    expect(wrapper).toMatchSnapshot();
  });

  it('should enable insights api key input', () => {
    const wrapper = setup({
      options: {
        secureJsonFields: {
          appInsightsApiKey: false,
        },
        jsonData: {
          appInsightsAppId: 'cddcc020-2c94-460a-a3d0-df3147ffa792',
        },
        secureJsonData: {
          appInsightsApiKey: 'e7f3f661-a933-4b3f-8176-51c4f982ec48',
        },
      },
    });
    expect(wrapper).toMatchSnapshot();
  });

  it('should disable buttons and inputs', () => {
    const wrapper = setup({
      options: {
        secureJsonFields: {
          appInsightsApiKey: true,
        },
        jsonData: {
          appInsightsAppId: 'cddcc020-2c94-460a-a3d0-df3147ffa792',
        },
        secureJsonData: {
          appInsightsApiKey: 'e7f3f661-a933-4b3f-8176-51c4f982ec48',
        },
        readOnly: true,
      },
    });
    const buttons = wrapper.find(Button);
    const inputs = wrapper.find(Input);
    buttons.forEach((b) => expect(b.prop('disabled')).toBe(true));
    inputs.forEach((i) => expect(i.prop('disabled')).toBe(true));
  });
});
