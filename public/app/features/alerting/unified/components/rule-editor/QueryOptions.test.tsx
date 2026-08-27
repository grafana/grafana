import { act, render, screen, userEvent, waitFor } from 'test/test-utils';

import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { QueryOptions } from './QueryOptions';

const query: AlertQuery = {
  refId: 'A',
  queryType: '',
  datasourceUid: 'prometheus',
  model: { refId: 'A' },
};

function renderQueryOptions(queryOptions = { maxDataPoints: 100, minInterval: '1m' }) {
  const onChangeQueryOptions = jest.fn();

  render(
    <QueryOptions query={query} queryOptions={queryOptions} onChangeQueryOptions={onChangeQueryOptions} index={0} />
  );

  return { onChangeQueryOptions };
}

async function flushFloatingUi() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function openOptions() {
  await userEvent.click(screen.getByRole('button', { name: /options/i }));
  expect(await screen.findByTestId('toggletip-content')).toBeInTheDocument();
  await flushFloatingUi();
}

async function dismissWithoutBlur() {
  // Escape and click-outside both close the toggletip via onClose without a blur on the
  // focused input, which is the path that used to drop the in-progress value.
  await userEvent.keyboard('{Escape}');
  await flushFloatingUi();
}

describe('QueryOptions', () => {
  it('saves the interval when the tooltip is dismissed without blur', async () => {
    const { onChangeQueryOptions } = renderQueryOptions();

    await openOptions();

    const intervalInput = screen.getByRole('textbox', { name: /interval/i });
    await userEvent.clear(intervalInput);
    await userEvent.type(intervalInput, '5m');

    expect(onChangeQueryOptions).not.toHaveBeenCalled();

    dismissWithoutBlur();

    await waitFor(() => {
      expect(onChangeQueryOptions).toHaveBeenCalledTimes(1);
    });
    expect(onChangeQueryOptions).toHaveBeenCalledWith({ maxDataPoints: 100, minInterval: '5m' }, 0);
  });

  it('does not persist query options when the tooltip is dismissed with no edits', async () => {
    const { onChangeQueryOptions } = renderQueryOptions();

    await openOptions();
    dismissWithoutBlur();

    await waitFor(() => {
      expect(screen.queryByTestId('toggletip-content')).not.toBeInTheDocument();
    });
    expect(onChangeQueryOptions).not.toHaveBeenCalled();
  });
});
