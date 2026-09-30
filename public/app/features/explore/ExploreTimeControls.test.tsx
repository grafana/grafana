import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { rangeUtil } from '@grafana/data';

import { ExploreTimeControls } from './ExploreTimeControls';

it('passes precise bounds from the Explore picker to URL state', async () => {
  const user = userEvent.setup();
  const onChangeTime = jest.fn();
  const range = rangeUtil.convertRawToRange({
    from: '2023-06-14T07:49:50.123000001Z',
    to: '2023-06-14T07:49:50.123999999Z',
  });
  render(
    <ExploreTimeControls
      exploreId="left"
      range={range}
      timeZone="utc"
      fiscalYearStartMonth={0}
      splitted={false}
      syncedTimes={false}
      onChangeTime={onChangeTime}
      onChangeTimeSync={() => {}}
      onChangeTimeZone={() => {}}
      onChangeFiscalYearStartMonth={() => {}}
    />
  );
  await user.click(screen.getByLabelText(/Time range selected/));
  await user.click(screen.getByRole('button', { name: 'Apply time range' }));
  expect(onChangeTime).toHaveBeenCalledWith({
    from: '2023-06-14T07:49:50.123000001Z',
    to: '2023-06-14T07:49:50.123999999Z',
  });
});
