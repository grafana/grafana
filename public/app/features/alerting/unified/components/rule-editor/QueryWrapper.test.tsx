import { render, screen, userEvent } from 'test/test-utils';

import { MaxDataPointsOption, MinIntervalOption } from './QueryWrapper';

describe('MaxDataPointsOption', () => {
  it('reports the parsed value on change without requiring blur', async () => {
    const onChange = jest.fn();
    render(<MaxDataPointsOption options={{ minInterval: '1m' }} onChange={onChange} />);

    await userEvent.type(screen.getByRole('spinbutton', { name: /max data points/i }), '250');

    expect(onChange).toHaveBeenLastCalledWith({ minInterval: '1m', maxDataPoints: 250 });
  });
});

describe('MinIntervalOption', () => {
  it('reports the typed interval on change without requiring blur', async () => {
    const onChange = jest.fn();
    render(<MinIntervalOption options={{ maxDataPoints: 100 }} onChange={onChange} />);

    await userEvent.type(screen.getByRole('textbox', { name: /interval/i }), '5m');

    expect(onChange).toHaveBeenLastCalledWith({ maxDataPoints: 100, minInterval: '5m' });
  });
});
