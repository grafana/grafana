import { useState } from 'react';

import { render, screen } from '../../../../../tests/test-utils';
import { type RoutingTimings } from '../../constants';
import { isValidPromDuration } from '../../utils/promDuration';

import { TimingsOverride } from './TimingsOverride';

function StatefulTimings({ initial, onChange }: { initial: RoutingTimings; onChange?: (v: RoutingTimings) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <TimingsOverride
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe('TimingsOverride', () => {
  it('shows the default timings and no fields while there is no override', () => {
    render(<TimingsOverride value={{}} onChange={jest.fn()} />);

    expect(screen.getByText('30s')).toBeInTheDocument();
    expect(screen.getByText('5m')).toBeInTheDocument();
    expect(screen.getByText('4h')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^group wait$/i)).not.toBeInTheDocument();
  });

  it('reveals the fields when switched on, without emitting a value yet', async () => {
    const onChange = jest.fn();
    const { user } = render(<TimingsOverride value={{}} onChange={onChange} />);

    await user.click(screen.getByRole('switch', { name: /override timings/i }));

    expect(await screen.findByLabelText(/^group wait$/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('emits the edited timing merged with the rest of the value', async () => {
    const onChange = jest.fn();
    const { user } = render(
      <StatefulTimings initial={{ groupWait: '1m', repeatInterval: '6h' }} onChange={onChange} />
    );

    await user.type(screen.getByLabelText(/^group interval$/i), '10m');

    expect(onChange).toHaveBeenLastCalledWith({ groupWait: '1m', repeatInterval: '6h', groupInterval: '10m' });
  });

  it('clears all three timings when switched off', async () => {
    const onChange = jest.fn();
    const { user } = render(
      <TimingsOverride value={{ groupWait: '1m', groupInterval: '10m', repeatInterval: '6h' }} onChange={onChange} />
    );

    await user.click(screen.getByRole('switch', { name: /override timings/i }));

    expect(onChange).toHaveBeenCalledWith({
      groupWait: undefined,
      groupInterval: undefined,
      repeatInterval: undefined,
    });
  });

  it('keeps the fields open when the only set timing is cleared', async () => {
    const { user } = render(<StatefulTimings initial={{ groupWait: '1m' }} />);

    await user.clear(screen.getByLabelText(/^group wait$/i));
    await user.tab();

    expect(screen.getByLabelText(/^group wait$/i)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /override timings/i })).toBeChecked();
  });

  it('passes an invalid duration to the parent as typed, leaving it to gate on isValidPromDuration', async () => {
    const onChange = jest.fn();
    const { user } = render(<StatefulTimings initial={{ groupWait: '20s' }} onChange={onChange} />);

    await user.type(screen.getByLabelText(/^group wait$/i), '4h');

    const [lastValue] = onChange.mock.calls.at(-1);
    expect(lastValue.groupWait).toBe('20s4h');
    expect(isValidPromDuration(lastValue.groupWait)).toBe(false);
  });

  it('disables the switch', () => {
    render(<TimingsOverride value={{}} onChange={jest.fn()} disabled />);

    expect(screen.getByRole('switch', { name: /override timings/i })).toBeDisabled();
  });

  it('shows the timings the rule inherits instead of the built-in defaults', () => {
    render(<TimingsOverride value={{}} defaults={{ groupWait: '1m' }} onChange={jest.fn()} />);

    expect(screen.getByText('1m')).toBeInTheDocument();
    expect(screen.getByText('5m')).toBeInTheDocument();
    expect(screen.getByText('4h')).toBeInTheDocument();
    expect(screen.queryByText('30s')).not.toBeInTheDocument();
  });

  it('falls back to the built-in default for a timing the defaults explicitly leave undefined', () => {
    render(
      <TimingsOverride value={{}} defaults={{ groupWait: undefined, groupInterval: '10m' }} onChange={jest.fn()} />
    );

    expect(screen.getByText('30s')).toBeInTheDocument();
    expect(screen.getByText('10m')).toBeInTheDocument();
  });

  it('uses the inherited timings as placeholders for the fields left unset in a partial override', async () => {
    render(<TimingsOverride value={{ groupInterval: '10m' }} defaults={{ groupWait: '1m' }} onChange={jest.fn()} />);

    expect(screen.getByLabelText(/^group wait$/i)).toHaveAttribute('placeholder', '1m');
    expect(screen.getByLabelText(/^group interval$/i)).toHaveValue('10m');
    expect(screen.getByLabelText(/^repeat interval$/i)).toHaveAttribute('placeholder', '4h');
  });

  it.each([/^group interval$/i, /^repeat interval$/i])('rejects a zero value in %s', async (name) => {
    const { user } = render(<StatefulTimings initial={{ groupWait: '1m' }} />);

    await user.type(screen.getByLabelText(name), '0s');
    await user.tab();

    expect(await screen.findByText(/greater than zero/i)).toBeInTheDocument();
  });

  it('accepts a zero group wait', async () => {
    const { user } = render(<StatefulTimings initial={{ groupWait: '1m' }} />);

    await user.clear(screen.getByLabelText(/^group wait$/i));
    await user.type(screen.getByLabelText(/^group wait$/i), '0s');
    await user.tab();

    expect(screen.queryByText(/greater than zero/i)).not.toBeInTheDocument();
  });

  it.each([/^group wait$/i, /^group interval$/i, /^repeat interval$/i])('rejects milliseconds in %s', async (name) => {
    const { user } = render(<StatefulTimings initial={{ groupWait: '1m' }} />);

    await user.type(screen.getByLabelText(name), '500ms');
    await user.tab();

    expect(await screen.findByText(/invalid duration format/i)).toBeInTheDocument();
  });
});
