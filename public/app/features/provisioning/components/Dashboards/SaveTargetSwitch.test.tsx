import { render, screen } from 'test/test-utils';

import { reportInteraction } from '@grafana/runtime';

import { SaveTargetSwitch } from './SaveTargetSwitch';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

describe('SaveTargetSwitch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // The button offers the target the user is not on, so the label names the destination, not the state
  it.each([
    { resource: undefined, target: 'repository' as const, label: 'Save to Grafana database instead' },
    { resource: undefined, target: 'database' as const, label: 'Save to Git repository instead' },
    { resource: 'folder' as const, target: 'repository' as const, label: 'Create in Grafana database instead' },
    { resource: 'folder' as const, target: 'database' as const, label: 'Create in Git repository instead' },
  ])('offers "$label" for a $resource on $target', ({ resource, target, label }) => {
    render(<SaveTargetSwitch resource={resource} target={target} onChange={jest.fn()} />);

    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  });

  it('hands back the target the user moved to, not the one they were on', async () => {
    const onChange = jest.fn();
    const { user } = render(<SaveTargetSwitch resource="folder" target="repository" onChange={onChange} />);

    await user.click(screen.getByRole('button'));

    expect(onChange).toHaveBeenCalledWith('database');
  });

  it('reports the switch for every surface, so folder and dashboard use are comparable', async () => {
    const { user, rerender } = render(<SaveTargetSwitch resource="folder" target="repository" onChange={jest.fn()} />);
    await user.click(screen.getByRole('button'));

    expect(reportInteraction).toHaveBeenCalledWith('grafana_provisioning_save_target_changed', {
      resource: 'folder',
      target: 'database',
    });

    rerender(<SaveTargetSwitch target="database" onChange={jest.fn()} />);
    await user.click(screen.getByRole('button'));

    expect(reportInteraction).toHaveBeenCalledWith('grafana_provisioning_save_target_changed', {
      resource: 'dashboard',
      target: 'repository',
    });
  });
});
