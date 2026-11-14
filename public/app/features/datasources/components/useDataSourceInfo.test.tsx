import { renderHook } from '@testing-library/react';
import { render, screen } from 'test/test-utils';

import { useDataSourceInfo } from './useDataSourceInfo';

describe('useDataSourceInfo', () => {
  it('should return no info items when the plugin name is not available yet', () => {
    const { result } = renderHook(() =>
      useDataSourceInfo({
        dataSourcePluginName: '',
        alertingSupported: true,
      })
    );

    expect(result.current).toHaveLength(0);
  });

  it('should omit the alerting badge while alerting support is still loading', () => {
    const { result } = renderHook(() =>
      useDataSourceInfo({
        dataSourcePluginName: 'Prometheus',
        alertingSupported: false,
        alertingLoading: true,
      })
    );

    expect(result.current.map((item) => item.label)).not.toContain('Alerting');
  });

  it('should show a "Supported" badge when alerting is supported', () => {
    const { result } = renderHook(() =>
      useDataSourceInfo({
        dataSourcePluginName: 'Prometheus',
        alertingSupported: true,
      })
    );

    const alertingItem = result.current.find((item) => item.label === 'Alerting');
    render(<>{alertingItem?.value}</>);

    expect(screen.getByText('Supported')).toBeInTheDocument();
  });

  it('should show a "Not supported" badge when alerting is not supported', () => {
    const { result } = renderHook(() =>
      useDataSourceInfo({
        dataSourcePluginName: 'TestData',
        alertingSupported: false,
      })
    );

    const alertingItem = result.current.find((item) => item.label === 'Alerting');
    render(<>{alertingItem?.value}</>);

    expect(screen.getByText('Not supported')).toBeInTheDocument();
  });

  it('should omit the Advisor badge when advisor has not checked the datasource', () => {
    const { result } = renderHook(() =>
      useDataSourceInfo({
        dataSourcePluginName: 'Prometheus',
        alertingSupported: true,
      })
    );

    expect(result.current.map((item) => item.label)).not.toContain('Advisor');
  });

  it('should show a "Success" Advisor badge when advisor has checked the datasource and there is no failure', () => {
    const { result } = renderHook(() =>
      useDataSourceInfo({
        dataSourcePluginName: 'Prometheus',
        alertingSupported: true,
        advisorChecked: true,
      })
    );

    const advisorItem = result.current.find((item) => item.label === 'Advisor');
    render(<>{advisorItem?.value}</>);

    expect(screen.getByText('Success')).toBeInTheDocument();
  });
});

describe('useDataSourceInfo provisioning', () => {
  it('omits the "Managed by" item for an unmanaged data source', () => {
    const { result } = renderHook(() =>
      useDataSourceInfo({
        dataSourcePluginName: 'Prometheus',
        alertingSupported: true,
        managedResource: { metadata: { annotations: {} } },
      })
    );

    expect(result.current.map((item) => item.label)).not.toContain('Managed by');
  });

  it('shows a "Managed by" badge for a repository-managed data source', async () => {
    const { result } = renderHook(() =>
      useDataSourceInfo({
        dataSourcePluginName: 'Prometheus',
        alertingSupported: true,
        managedResource: {
          metadata: {
            annotations: {
              'grafana.app/managedBy': 'repo',
              'grafana.app/managerId': 'test-repo',
              'grafana.app/sourcePath': 'datasources/prom.json',
            },
          },
        },
      })
    );

    const item = result.current.find((item) => item.label === 'Managed by');
    expect(item).toBeDefined();
    const { user } = render(<>{item?.value}</>);

    await user.hover(screen.getByTestId('icon-exchange-alt'));
    expect(await screen.findByText('Managed by: Repository test-repo')).toBeInTheDocument();
  });
});
