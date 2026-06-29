import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { ComingSoonChecks } from './AnnotationPolicySettings';

describe('ComingSoonChecks', () => {
  it('renders all 7 coming-soon checks with a "Coming soon" badge', () => {
    render(<ComingSoonChecks />);

    expect(screen.getByText('More checks (coming soon)')).toBeInTheDocument();

    const labels = [
      'Detect no contact point',
      'Detect flapping alerts',
      'Detect redundant alerts',
      'Suggest multidimensional candidates',
      'Suggest forecast candidates',
      'Suggest SLO candidates',
      'Suggest potential groups',
    ];
    labels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    expect(screen.getAllByText('Coming soon')).toHaveLength(labels.length);

    // Each check shows its description, like the working policies.
    expect(
      screen.getByText(
        "Flag alert rules whose notifications aren't routed to any contact point, so firing alerts never reach anyone."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Identify related rules that could be organized into evaluation groups for more consistent timing and routing.'
      )
    ).toBeInTheDocument();
  });

  it('renders the switches as disabled and off', () => {
    render(<ComingSoonChecks />);

    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(7);
    switches.forEach((toggle) => {
      expect(toggle).toBeDisabled();
      expect(toggle).not.toBeChecked();
    });
  });
});
