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
});
