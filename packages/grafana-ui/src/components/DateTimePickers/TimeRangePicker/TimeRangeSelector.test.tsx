import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { rangeUtil } from '@grafana/data';

import { TimeRangeSelector, type TimeRangeSelectorProps } from '../../../unstable';

describe('TimeRangeSelector', () => {
  it.each([
    { name: 'default', quickOptions: undefined, label: 'Last 5 minutes', from: 'now-5m' },
    {
      name: 'custom',
      quickOptions: [{ display: 'Last 17 minutes', from: 'now-17m', to: 'now' }],
      label: 'Last 17 minutes',
      from: 'now-17m',
    },
  ])('selects $name quick ranges', async ({ quickOptions, label, from }) => {
    const onChange = jest.fn();
    const props: TimeRangeSelectorProps = {
      value: rangeUtil.convertRawToRange({ from: 'now-6h', to: 'now' }),
      onChange,
      onChangeTimeZone: jest.fn(),
      quickOptions,
    };
    render(<TimeRangeSelector {...props} />);
    const ranges = screen.getByRole('presentation');
    await userEvent.click(within(ranges).getByText(label));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ raw: { from, to: 'now' } }));
    if (quickOptions) {
      expect(screen.queryByText('Last 5 minutes')).not.toBeInTheDocument();
    }
  });
});
