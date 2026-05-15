import { render, screen } from 'test/test-utils';

import { GrafanaEdition } from '@grafana/data/internal';
import { config } from '@grafana/runtime';

import HomePage from './HomePage';

describe('HomePage', () => {
  const originalBuildInfo = { ...config.buildInfo };
  const originalNamespace = config.namespace;

  afterEach(() => {
    config.buildInfo = { ...originalBuildInfo };
    config.namespace = originalNamespace;
  });

  it('renders the greeting', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: /^Good \w+\.$/ })).toBeInTheDocument();
  });

  it('renders the OSS welcome message', () => {
    config.buildInfo.edition = GrafanaEdition.OpenSource;

    render(<HomePage />);
    expect(screen.getByText('Welcome to Grafana.')).toBeInTheDocument();
  });

  it('renders the Enterprise welcome message', () => {
    config.buildInfo.edition = GrafanaEdition.Enterprise;

    render(<HomePage />);
    expect(screen.getByText('Welcome to Grafana Enterprise.')).toBeInTheDocument();
  });

  it('renders the Cloud welcome message', () => {
    config.namespace = 'stacks-12345';

    render(<HomePage />);
    expect(screen.getByText('Welcome to Grafana Cloud.')).toBeInTheDocument();
  });
});
