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
      },
      version: 1,
      readOnly: false,
    },
    updateOptions: jest.fn(),
  };

  if (propsFunc) {
    props = propsFunc(props);
  }

  return render(<AnalyticsConfig {...props} />);
};

describe('Render', () => {
  it('should disable log analytics credentials form', () => {
    setup((props) => ({
      ...props,
      options: {
        ...props.options,
        jsonData: {
          ...props.options.jsonData,
          azureLogAnalyticsSameAs: true,
        },
      },
    }));
    expect(screen.queryByText('Azure Monitor Logs')).not.toBeInTheDocument();
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
});
