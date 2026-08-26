import { render, screen } from 'test/test-utils';

import { dateTime, isDateTime, type TimeRange } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { NotebookTimeRangePicker } from './NotebookTimeRangePicker';

/** The window every test starts from, expressed the way a notebook holds a *relative* range. */
const RELATIVE_RANGE: TimeRange = {
  from: dateTime('2026-08-26T09:00:00Z'),
  to: dateTime('2026-08-26T15:00:00Z'),
  raw: { from: 'now-6h', to: 'now' },
};

function setup(value: TimeRange = RELATIVE_RANGE) {
  const onChange = jest.fn();
  const onChangeTimeZone = jest.fn();
  const rendered = render(
    <NotebookTimeRangePicker value={value} timeZone="utc" onChange={onChange} onChangeTimeZone={onChangeTimeZone} />
  );

  return { ...rendered, onChange, onChangeTimeZone };
}

const openPicker = () => screen.getByTestId(selectors.components.TimePicker.openButton);

/** The single range handed to onChange, with its raw ends described the way the assertions need. */
function reportedRange(onChange: jest.Mock) {
  expect(onChange).toHaveBeenCalledTimes(1);
  const range: TimeRange = onChange.mock.calls[0][0];

  return {
    rawFromIsDateTime: isDateTime(range.raw.from),
    rawToIsDateTime: isDateTime(range.raw.to),
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    rawFrom: isDateTime(range.raw.from) ? range.raw.from.toISOString() : range.raw.from,
    rawTo: isDateTime(range.raw.to) ? range.raw.to.toISOString() : range.raw.to,
  };
}

describe('NotebookTimeRangePicker', () => {
  it('shows a relative range as the fixed window it currently resolves to', () => {
    setup();

    expect(openPicker()).toHaveTextContent('2026-08-26 09:00:00 to 2026-08-26 15:00:00');
    expect(screen.queryByText('Last 6 hours')).not.toBeInTheDocument();
  });

  it('offers no quick ranges to pick from', async () => {
    const { user } = setup();

    await user.click(openPicker());

    expect(await screen.findByText('Absolute time range')).toBeInTheDocument();
    expect(screen.queryByText('Last 6 hours')).not.toBeInTheDocument();
    expect(screen.queryByText('Last 24 hours')).not.toBeInTheDocument();
  });

  it('reports the window typed into the form', async () => {
    const { user, onChange } = setup();

    await user.click(openPicker());
    await user.clear(await screen.findByTestId(selectors.components.TimePicker.fromField));
    await user.type(screen.getByTestId(selectors.components.TimePicker.fromField), '2026-08-20 00:00:00');
    await user.clear(screen.getByTestId(selectors.components.TimePicker.toField));
    await user.type(screen.getByTestId(selectors.components.TimePicker.toField), '2026-08-21 00:00:00');
    await user.click(screen.getByTestId(selectors.components.TimePicker.applyTimeRange));

    expect(reportedRange(onChange)).toEqual({
      rawFromIsDateTime: true,
      rawToIsDateTime: true,
      from: '2026-08-20T00:00:00.000Z',
      to: '2026-08-21T00:00:00.000Z',
      rawFrom: '2026-08-20T00:00:00.000Z',
      rawTo: '2026-08-21T00:00:00.000Z',
    });
  });

  // Hiding the quick ranges does not stop someone typing `now-1h` into the form, and
  // convertRawToRange deliberately keeps a math string in `raw`. Without the pin, this notebook
  // would go on sliding. The far-future "to" keeps the form valid whatever the clock says, which is
  // also why the assertion is the shape of the reported end rather than a wall-clock literal.
  it('pins a relative expression to a fixed window before reporting it', async () => {
    const { user, onChange } = setup();

    await user.click(openPicker());
    await user.clear(await screen.findByTestId(selectors.components.TimePicker.toField));
    await user.type(screen.getByTestId(selectors.components.TimePicker.toField), '2099-01-01 00:00:00');
    await user.clear(screen.getByTestId(selectors.components.TimePicker.fromField));
    await user.type(screen.getByTestId(selectors.components.TimePicker.fromField), 'now-1h');
    await user.click(screen.getByTestId(selectors.components.TimePicker.applyTimeRange));

    const reported = reportedRange(onChange);
    // Without the pin this is the string 'now-1h'.
    expect(reported.rawFromIsDateTime).toBe(true);
    // And it is the moment the expression resolved to, not some other end of the range.
    expect(reported.rawFrom).toBe(reported.from);
    expect(reported.rawTo).toBe('2099-01-01T00:00:00.000Z');
  });

  // TimeRangeInput hides the timezone footer by default, and a notebook persists its timezone — so
  // taking the default would leave a saved field with no way to change it.
  it('keeps the timezone control reachable', async () => {
    const { user } = setup();

    await user.click(openPicker());

    expect(await screen.findByLabelText('Time zone selection')).toBeInTheDocument();
  });
});
