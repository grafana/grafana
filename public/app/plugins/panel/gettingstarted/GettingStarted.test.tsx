import { render, screen } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { testWithFeatureToggles } from 'app/features/alerting/unified/test/test-utils';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';

import { getPanelProps } from '../test-utils';

import { GettingStarted } from './GettingStarted';

const mockMetricsDataSource = mockDataSource(undefined, { metrics: true });

setBackendSrv(backendSrv);
setupDataSources(mockMetricsDataSource);
setupMockServer();

describe.each([
  // App platform APIs
  true,
  // Legacy APIs
  false,
])('GettingStarted - app platform APIs: %s', (featureTogglesEnabled) => {
  testWithFeatureToggles(featureTogglesEnabled ? ['unifiedStorageSearchUI'] : []);

  it('renders getting started steps', async () => {
    const props = getPanelProps({});
    render(<GettingStarted {...props} />);

    const headings = (await screen.findAllByRole('heading')).map((heading) => heading.textContent);
    expect(headings).toEqual([
      'Basic',
      'Grafana fundamentals',
      'Add your first data source',
      'Create your first dashboard',
    ]);
    const dataSourceStepLink = await screen.findByRole('link', { name: /add your first data source/i });
    expect(dataSourceStepLink).toHaveTextContent(/complete/i);

    const dashboardStepLink = await screen.findByRole('link', { name: /create your first dashboard/i });
    expect(dashboardStepLink).toHaveTextContent(/complete/i);
  });

  it('allows navigating between steps', async () => {
    const props = getPanelProps({});
    const { user } = render(<GettingStarted {...props} />);

    await user.click(await screen.findByRole('button', { name: /to advanced tutorials/i }));
    const [firstAdvHeading] = await screen.findAllByRole('heading');
    expect(firstAdvHeading).toHaveTextContent(/advanced/i);

    await user.click(await screen.findByRole('button', { name: /to basic tutorials/i }));
    const [firstBasicHeading] = await screen.findAllByRole('heading');
    expect(firstBasicHeading).toHaveTextContent(/basic/i);
  });
});
