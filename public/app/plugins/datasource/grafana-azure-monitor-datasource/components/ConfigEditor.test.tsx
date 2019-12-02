import React from 'react';
import { shallow } from 'enzyme';
import ConfigEditor, { Props } from './ConfigEditor';

const setup = () => {
  const props: Props = {
    options: {
      id: 21,
      orgId: 1,
      name: 'Azure Monitor-10-10',
      type: 'grafana-azure-monitor-datasource',
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
        subscriptionId: '',
        azureLogAnalyticsSameAs: true,
        cloudName: 'azuremonitor',
      },
      secureJsonFields: {},
      version: 1,
      readOnly: false,
    },
    onOptionsChange: jest.fn(),
  };

  return shallow(<ConfigEditor {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });
});
