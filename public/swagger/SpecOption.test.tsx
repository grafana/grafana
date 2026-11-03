import { render, screen } from '@testing-library/react';

import { SpecOption } from './SpecOption';

const base = { key: 'dashboard.grafana.app-v1', label: 'dashboard.grafana.app/v1', url: 'openapi/v3/x', group: 'g' };

it('shows the full group/version label', () => {
  render(<SpecOption spec={{ ...base, version: 'v1' }} />);

  expect(screen.getByText('dashboard.grafana.app/v1')).toBeInTheDocument();
});

it('badges the preferred version', () => {
  render(<SpecOption spec={{ ...base, version: 'v1', preferred: true }} />);

  expect(screen.getByText('Preferred')).toBeInTheDocument();
});

it('does not badge other versions', () => {
  render(<SpecOption spec={{ ...base, version: 'v0alpha1' }} />);

  expect(screen.queryByText('Preferred')).not.toBeInTheDocument();
});
