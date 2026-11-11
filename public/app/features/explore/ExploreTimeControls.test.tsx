import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getDefaultTimeRange } from '@grafana/data';
import { config } from '@grafana/runtime';

import { ExploreTimeControls, type Props } from './ExploreTimeControls';

describe('ExploreTimeControls', () => {
  const originalQuickRanges = config.quickRanges;

  afterEach(() => {
    config.quickRanges = originalQuickRanges;
  });

  it.each([false, true])('selects server-configured presets when splitted=%s', async (splitted) => {
    config.quickRanges = [{ from: 'now-14d', to: 'now', display: 'Customer fortnight' }];
    const { user, onChangeTime } = setup({ splitted });

    await user.click(screen.getByLabelText(/Time range selected/));
    const preset = screen.getByText('Customer fortnight');
    expect(preset).toBeInTheDocument();
    expect(screen.queryByText('Last 5 minutes')).not.toBeInTheDocument();

    await user.click(preset);

    expect(onChangeTime).toHaveBeenCalledWith({ from: 'now-14d', to: 'now' });
  });

  it('selects built-in presets when no server quick ranges are configured', async () => {
    config.quickRanges = undefined;
    const { user, onChangeTime } = setup();

    await user.click(screen.getByLabelText(/Time range selected/));
    await user.click(screen.getByText('Last 5 minutes'));

    expect(onChangeTime).toHaveBeenCalledWith({ from: 'now-5m', to: 'now' });
  });
});

function setup(props: Partial<Props> = {}) {
  const user = userEvent.setup();
  const onChangeTime = jest.fn();

  render(
    <ExploreTimeControls
      exploreId="left"
      range={getDefaultTimeRange()}
      timeZone="utc"
      fiscalYearStartMonth={0}
      splitted={false}
      syncedTimes={false}
      onChangeTimeSync={jest.fn()}
      onChangeTime={onChangeTime}
      onChangeTimeZone={jest.fn()}
      onChangeFiscalYearStartMonth={jest.fn()}
      {...props}
    />
  );

  return { user, onChangeTime };
}
