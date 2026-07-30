import { render, screen, userEvent } from 'test/test-utils';

import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { QueryOptions } from './QueryOptions';
import { MaxDataPointsOption, MinIntervalOption } from './QueryWrapper';

describe('query options', () => {
  it('saves max data points when unmounted before blur', async () => {
    const onChange = jest.fn();
    const { unmount } = render(<MaxDataPointsOption options={{}} onChange={onChange} />);

    await userEvent.type(screen.getByRole('spinbutton'), '1234');
    unmount();

    expect(onChange).toHaveBeenCalledWith({ maxDataPoints: 1234 });
  });

  it('saves the interval when unmounted before blur', async () => {
    const onChange = jest.fn();
    const { unmount } = render(<MinIntervalOption options={{}} onChange={onChange} />);

    await userEvent.type(screen.getByRole('textbox'), '15s');
    unmount();

    expect(onChange).toHaveBeenCalledWith({ minInterval: '15s' });
  });

  it('keeps max data points zero normalized when unmounted before blur', async () => {
    const onChange = jest.fn();
    const { unmount } = render(<MaxDataPointsOption options={{ maxDataPoints: 100 }} onChange={onChange} />);
    const input = screen.getByRole('spinbutton');

    await userEvent.clear(input);
    await userEvent.type(input, '0');
    unmount();

    expect(onChange).toHaveBeenCalledWith({ maxDataPoints: undefined });
  });

  it('does not save max data points twice when blur happens before unmount', async () => {
    const onChange = jest.fn();
    const { unmount } = render(<MaxDataPointsOption options={{}} onChange={onChange} />);
    const input = screen.getByRole('spinbutton');

    await userEvent.type(input, '1234');
    await userEvent.tab();
    unmount();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ maxDataPoints: 1234 });
  });

  it('saves max data points when clicking outside the Options toggletip', async () => {
    const onChangeQueryOptions = jest.fn();
    render(
      <QueryOptions
        query={{ relativeTimeRange: { from: 300, to: 0 } } as AlertQuery}
        queryOptions={{}}
        onChangeQueryOptions={onChangeQueryOptions}
        index={0}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /options/i }));
    await userEvent.type(await screen.findByRole('spinbutton'), '1234');
    await userEvent.click(document.body);

    expect(onChangeQueryOptions).toHaveBeenCalledWith({ maxDataPoints: 1234 }, 0);
  });
});
