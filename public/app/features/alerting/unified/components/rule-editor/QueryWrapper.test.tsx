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

  it('does not commit a bare-number prefix while typing towards a unit (e.g. "1" on the way to "1m")', async () => {
    const onChange = jest.fn();
    render(<MinIntervalOption options={{}} onChange={onChange} />);

    // typing "1m" char-by-char passes through "1", which `describeInterval` treats as a
    // valid (seconds) interval on its own, but it must not be committed upstream since the
    // user may still be typing a unit suffix
    await userEvent.type(screen.getByRole('textbox'), '1m');

    expect(onChange).not.toHaveBeenCalledWith({ minInterval: '1' });
    expect(onChange).toHaveBeenCalledWith({ minInterval: '1m' });
  });

  it('does not commit a partial decimal number while typing towards a unit (e.g. "1." on the way to "1.5s")', async () => {
    const onChange = jest.fn();
    render(<MinIntervalOption options={{}} onChange={onChange} />);

    // typing "1.5s" char-by-char passes through "1" and "1.", which describeInterval accepts
    // via Number("1."), but must not be committed upstream mid-typing
    await userEvent.type(screen.getByRole('textbox'), '1.5s');

    expect(onChange).not.toHaveBeenCalledWith({ minInterval: '1' });
    expect(onChange).not.toHaveBeenCalledWith({ minInterval: '1.' });
    expect(onChange).not.toHaveBeenCalledWith({ minInterval: '1.5' });
    expect(onChange).toHaveBeenCalledWith({ minInterval: '1.5s' });
  });

  it('commits a bare-number interval on blur', async () => {
    const onChange = jest.fn();
    render(<MinIntervalOption options={{}} onChange={onChange} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '30');
    await userEvent.tab();

    expect(onChange).toHaveBeenCalledWith({ minInterval: '30' });
  });
});
