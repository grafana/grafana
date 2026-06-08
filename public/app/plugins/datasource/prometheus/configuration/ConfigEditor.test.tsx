import { render, screen } from '@testing-library/react';

import { type DataSourceSettings } from '@grafana/data';
import { type PromOptions } from '@grafana/prometheus';

import { ConfigEditor } from './ConfigEditor';

function createDefaultConfigOptions(): DataSourceSettings<PromOptions> {
  return {
    jsonData: {},
    secureJsonFields: {},
    access: 'proxy',
  } as DataSourceSettings<PromOptions>;
}

describe('ConfigEditor', () => {
  it('renders without error', () => {
    expect(() =>
      render(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />)
    ).not.toThrow();
  });

  it('shows browser access mode alert when access is direct', () => {
    const options = { ...createDefaultConfigOptions(), access: 'direct' as const };
    render(<ConfigEditor onOptionsChange={() => {}} options={options} />);
    expect(
      screen.getByText(/Browser access mode in the Prometheus data source is no longer available/)
    ).toBeInTheDocument();
  });

  it('does not show browser access mode alert for proxy access', () => {
    render(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />);
    expect(
      screen.queryByText(/Browser access mode in the Prometheus data source is no longer available/)
    ).not.toBeInTheDocument();
  });

  it('renders the Prometheus server URL input', () => {
    render(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />);
    expect(screen.getByPlaceholderText('http://localhost:9090')).toBeInTheDocument();
  });

  it('renders the Authentication section', () => {
    render(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />);
    expect(screen.getByRole('heading', { name: 'Authentication' })).toBeInTheDocument();
  });

  it('renders the Advanced settings section', () => {
    render(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />);
    expect(screen.getByText('Advanced settings')).toBeInTheDocument();
  });
});
