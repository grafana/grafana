import { render, screen } from 'test/test-utils';

import { RuleStatusIcon } from './RuleStatusIcon';

describe('RuleStatusIcon', () => {
  it.each([
    { state: 'Firing', label: 'Firing' },
    { state: 'Pending', label: 'Pending' },
    { state: 'Recovering', label: 'Recovering' },
    { state: 'Healthy', label: 'Normal' },
    { state: 'Inactive', label: 'Normal' },
  ])('maps alert state $state to the $label icon', ({ state, label }) => {
    render(<RuleStatusIcon kind="alert" state={state} health="OK" />);
    expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it.each([
    { health: 'Error', label: 'Failed to evaluate rule' },
    { health: 'NoData', label: 'Insufficient data' },
  ])('health $health overrides the alert state with "$label"', ({ health, label }) => {
    render(<RuleStatusIcon kind="alert" state="Firing" health={health} />);
    expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.queryByLabelText('Firing')).not.toBeInTheDocument();
  });

  it('shows Paused when spec.paused is set, regardless of state', () => {
    render(<RuleStatusIcon kind="alert" state="Firing" health="OK" paused />);
    expect(screen.getByLabelText('Paused')).toBeInTheDocument();
  });

  it('shows Paused for health Paused', () => {
    render(<RuleStatusIcon kind="alert" state="Healthy" health="Paused" />);
    expect(screen.getByLabelText('Paused')).toBeInTheDocument();
  });

  it('shows the Recording icon for a recording rule with health Recording', () => {
    render(<RuleStatusIcon kind="recording" health="Recording" />);
    expect(screen.getByLabelText('Recording')).toBeInTheDocument();
  });

  it('shows the failed icon for a recording rule with health Error', () => {
    render(<RuleStatusIcon kind="recording" health="Error" />);
    expect(screen.getByLabelText('Failed to evaluate rule')).toBeInTheDocument();
  });

  it('matches values case-insensitively', () => {
    render(<RuleStatusIcon kind="alert" state="FIRING" />);
    expect(screen.getByLabelText('Firing')).toBeInTheDocument();
  });

  it.each([
    { name: 'no status at all', props: {} },
    { name: 'health Unknown without a state', props: { health: 'Unknown' } },
    { name: 'health OK without a state', props: { health: 'OK' } },
  ])('renders "Status unavailable" instead of the unknown state icon for $name', ({ props }) => {
    render(<RuleStatusIcon kind="alert" {...props} />);
    expect(screen.getByLabelText('Status unavailable')).toBeInTheDocument();
    expect(screen.queryByLabelText('Unknown')).not.toBeInTheDocument();
  });

  it('renders "Status unavailable" for a recording rule without health', () => {
    render(<RuleStatusIcon kind="recording" />);
    expect(screen.getByLabelText('Status unavailable')).toBeInTheDocument();
  });
});
