import { render, screen } from 'test/test-utils';

import { RuleStatusIcon } from './RuleStatusIcon';

type Props = Parameters<typeof RuleStatusIcon>[0];

describe('RuleStatusIcon', () => {
  it.each<{ name: string; props: Props; label: string }>([
    { name: 'state Firing', props: { kind: 'alert', state: 'Firing', health: 'OK' }, label: 'Firing' },
    { name: 'state Pending', props: { kind: 'alert', state: 'Pending', health: 'OK' }, label: 'Pending' },
    { name: 'state Recovering', props: { kind: 'alert', state: 'Recovering', health: 'OK' }, label: 'Recovering' },
    { name: 'state Healthy', props: { kind: 'alert', state: 'Healthy', health: 'OK' }, label: 'Normal' },
    { name: 'state Inactive', props: { kind: 'alert', state: 'Inactive', health: 'OK' }, label: 'Normal' },
    {
      name: 'health Error over state Firing',
      props: { kind: 'alert', state: 'Firing', health: 'Error' },
      label: 'Failed to evaluate rule',
    },
    {
      name: 'health NoData over state Firing',
      props: { kind: 'alert', state: 'Firing', health: 'NoData' },
      label: 'Insufficient data',
    },
    {
      name: 'paused over state Firing',
      props: { kind: 'alert', state: 'Firing', health: 'OK', paused: true },
      label: 'Paused',
    },
    { name: 'paused over health Unknown', props: { kind: 'alert', health: 'Unknown', paused: true }, label: 'Paused' },
    {
      name: 'stale health Paused with paused=false',
      props: { kind: 'alert', state: 'Healthy', health: 'Paused', paused: false },
      label: 'Normal',
    },
    {
      name: 'stale health Paused with paused unset',
      props: { kind: 'alert', state: 'Healthy', health: 'Paused' },
      label: 'Normal',
    },
    { name: 'recording health Recording', props: { kind: 'recording', health: 'Recording' }, label: 'Recording' },
    { name: 'recording health Error', props: { kind: 'recording', health: 'Error' }, label: 'Failed to evaluate rule' },
    { name: 'no status at all', props: { kind: 'alert' }, label: 'Status unavailable' },
    { name: 'health OK without a state', props: { kind: 'alert', health: 'OK' }, label: 'Status unavailable' },
    {
      name: 'health Unknown without a state',
      props: { kind: 'alert', health: 'Unknown' },
      label: 'Status unavailable',
    },
    { name: 'recording without health', props: { kind: 'recording' }, label: 'Status unavailable' },
    {
      name: 'recording health Unknown',
      props: { kind: 'recording', health: 'Unknown' },
      label: 'Status unavailable',
    },
  ])('shows the "$label" icon for $name', ({ props, label }) => {
    render(<RuleStatusIcon {...props} />);

    expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it.each<{ name: string; props: Props; shape: string }>([
    { name: 'Firing', props: { kind: 'alert', state: 'Firing' }, shape: 'icon-fire' },
    { name: 'Pending', props: { kind: 'alert', state: 'Pending' }, shape: 'icon-hourglass' },
    { name: 'Paused', props: { kind: 'alert', state: 'Firing', paused: true }, shape: 'icon-pause' },
    { name: 'Recording', props: { kind: 'recording', health: 'Recording' }, shape: 'icon-square-shape' },
    { name: 'Status unavailable', props: { kind: 'recording' }, shape: 'icon-square-shape' },
    { name: 'Status unavailable', props: { kind: 'alert' }, shape: 'icon-circle' },
  ])('draws $name as $shape', ({ name, props, shape }) => {
    render(<RuleStatusIcon {...props} />);

    expect(screen.getByLabelText(name)).toHaveAttribute('data-testid', shape);
  });
});
