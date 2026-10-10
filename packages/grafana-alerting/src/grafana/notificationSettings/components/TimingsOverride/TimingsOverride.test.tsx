import { useState } from 'react';

import { render, screen } from '../../../../../tests/test-utils';
import { type RoutingTimings } from '../../constants';

import { TimingsOverride } from './TimingsOverride';

function StatefulTimings({ initial }: { initial: RoutingTimings }) {
  const [value, setValue] = useState(initial);
  return <TimingsOverride value={value} onChange={setValue} />;
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
    const { user } = render(<TimingsOverride value={{ groupWait: '1m', repeatInterval: '6h' }} onChange={onChange} />);

    const field = screen.getByLabelText(/^group interval$/i);
    await user.type(field, '10m');
    await user.tab();

    expect(onChange).toHaveBeenCalledWith({ groupWait: '1m', repeatInterval: '6h', groupInterval: '10m' });
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

  it('disables the switch', () => {
    render(<TimingsOverride value={{}} onChange={jest.fn()} disabled />);

    expect(screen.getByRole('switch', { name: /override timings/i })).toBeDisabled();
  });
});
