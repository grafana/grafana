import { render, screen } from '@testing-library/react';
import React from 'react';

import ConfigEditor from './ConfigEditor';

describe('AppInsights ConfigEditor', () => {
  const baseOptions = {
    id: 21,
    uid: 'y',
    orgId: 1,
    name: 'Azure Monitor-10-10',
    type: 'grafana-azure-monitor-datasource',
    typeLogoUrl: '',
    typeName: 'Azure',
    access: 'proxy',
    url: '',
    user: '',
    database: '',
    basicAuth: false,
    basicAuthUser: '',
    withCredentials: false,
    isDefault: false,
    jsonData: {},
    secureJsonFields: {},
    version: 1,
    readOnly: false,
  };

  const jsonData = {
    subscriptionId: '44987801-6nn6-49he-9b2d-9106972f9789',
    azureLogAnalyticsSameAs: true,
    cloudName: 'azuremonitor',
  };

  const onOptionsChange = jest.fn();

  it('should not render application insights config for new data sources', () => {
    const options = {
      ...baseOptions,
      jsonData,
    };
    render(<ConfigEditor options={options} onOptionsChange={onOptionsChange} />);

    expect(screen.queryByText('Azure Application Insights')).not.toBeInTheDocument();
  });
});
