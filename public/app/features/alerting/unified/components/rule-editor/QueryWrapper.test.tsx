import userEvent from '@testing-library/user-event';
import { render, screen } from 'test/test-utils';

import { MaxDataPointsOption, MinIntervalOption } from './QueryWrapper';

describe('MaxDataPointsOption', () => {
  it('commits the value on change, without requiring blur', async () => {
    const onChange = jest.fn();
    render(<MaxDataPointsOption options={{}} onChange={onChange} />);

    await userEvent.type(screen.getByRole('spinbutton'), '500');

    expect(onChange).toHaveBeenCalledWith({ maxDataPoints: 500 });
  });
});

describe('MinIntervalOption', () => {
  it('commits the value on change, without requiring blur', async () => {
    const onChange = jest.fn();
    render(<MinIntervalOption options={{}} onChange={onChange} />);

    await userEvent.type(screen.getByRole('textbox'), '1m');

    expect(onChange).toHaveBeenCalledWith({ minInterval: '1m' });
  });

  it('does not commit a not-yet-valid interval while typing (e.g. "0" on the way to "0.5s")', async () => {
    const onChange = jest.fn();
    render(<MinIntervalOption options={{}} onChange={onChange} />);

    // typing this out char-by-char passes through "0", which is not a valid
    // interval on its own and must not be committed upstream
    await userEvent.type(screen.getByRole('textbox'), '0.5s');

    expect(onChange).not.toHaveBeenCalledWith({ minInterval: '0' });
    expect(onChange).toHaveBeenCalledWith({ minInterval: '0.5s' });
  });
});
