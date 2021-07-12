import React from 'react';
import { render, screen } from '@testing-library/react';
import AnalyticsConfig, { Props } from './AnalyticsConfig';
import userEvent from '@testing-library/user-event';

const setup = (propsFunc?: (props: Props) => Props) => {
  let props: Props = {
    options: {
      id: 21,
      uid: 'x',
      orgId: 1,
      name: 'Azure Monitor-10-10',
      type: 'grafana-azure-monitor-datasource',
      typeName: 'Azure',
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
      secureJsonFields: {},
      jsonData: {
        cloudName: '',
        subscriptionId: '',
        logAnalyticsDefaultWorkspace: '',
      },
      version: 1,
      readOnly: false,
    },
    updateOptions: jest.fn(),
    getSubscriptions: jest.fn(),
    getWorkspaces: jest.fn(),
  };

  if (propsFunc) {
    props = propsFunc(props);
  }

  return render(<AnalyticsConfig {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper.baseElement).toMatchSnapshot();
  });

  it('should disable log analytics credentials form', () => {
    const wrapper = setup((props) => ({
      ...props,
      options: {
        ...props.options,
        jsonData: {
          ...props.options.jsonData,
          azureLogAnalyticsSameAs: true,
        },
      },
    }));
    expect(wrapper.baseElement).toMatchSnapshot();
  });

  it('should enable azure log analytics load workspaces button', () => {
    const wrapper = setup((props) => ({
      ...props,
      options: {
        ...props.options,
        jsonData: {
          ...props.options.jsonData,
          azureLogAnalyticsSameAs: false,
          logAnalyticsDefaultWorkspace: '',
          tenantId: 'e7f3f661-a933-4b3f-8176-51c4f982ec48',
          clientId: '44693801-6ee6-49de-9b2d-9106972f9572',
          subscriptionId: 'e3fe4fde-ad5e-4d60-9974-e2f3562ffdf2',
          clientSecret: 'cddcc020-2c94-460a-a3d0-df3147ffa792',
        },
      },
    }));
    expect(wrapper.baseElement).toMatchSnapshot();
  });

  it('should not render the Switch to use different creds for log analytics by default', () => {
    setup();
    expect(screen.queryByText('is no longer supported', { exact: false })).not.toBeInTheDocument();
  });

  // Remove this test with deprecated code
  it('should not render the Switch if different creds for log analytics were set from before', () => {
    setup((props) => ({
      ...props,
      options: {
        ...props.options,
        jsonData: {
          ...props.options.jsonData,
          azureLogAnalyticsSameAs: false,
        },
      },
    }));
    expect(screen.queryByText('is no longer supported', { exact: false })).toBeInTheDocument();
  });

  it('should clean up the error when resetting the credentials', async () => {
    const onUpdate = jest.fn();
    setup((props) => ({
      ...props,
      options: {
        ...props.options,
        jsonData: {
          ...props.options.jsonData,
          azureLogAnalyticsSameAs: false,
        },
      },
      updateOptions: onUpdate,
    }));
    expect(screen.queryByText('is no longer supported', { exact: false })).toBeInTheDocument();
    userEvent.click(screen.getByText('Clear Azure Monitor Logs Credentials'));
    expect(onUpdate).toHaveBeenCalled();
    const newOpts = onUpdate.mock.calls[0][0]({});
    expect(newOpts).toEqual({ jsonData: { azureLogAnalyticsSameAs: true } });
  });

  it('should disable inputs', () => {
    setup((props) => ({
      ...props,
      options: {
        ...props.options,
        readOnly: true,
      },
    }));
    expect(screen.queryByText('Load Workspaces')?.closest('button')).toBeDisabled();
  });
});
