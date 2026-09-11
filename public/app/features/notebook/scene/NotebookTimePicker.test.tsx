import { render, screen } from 'test/test-utils';

import { type TimeRange } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneFlexItem, SceneFlexLayout, SceneTimeRange } from '@grafana/scenes';

import { NotebookTimePicker } from './NotebookTimePicker';

/**
 * The picker reads and writes the nearest SceneTimeRange, so it is rendered inside one. UTC so a typed
 * timestamp means the same thing wherever the suite runs, and `now-6h` so every test starts relative.
 */
function setup(raw: { from: string; to: string } = { from: 'now-6h', to: 'now' }) {
  const timeRange = new SceneTimeRange({ ...raw, timeZone: 'utc' });
  const picker = new NotebookTimePicker({});
  const scene = new SceneFlexLayout({ $timeRange: timeRange, children: [new SceneFlexItem({ body: picker })] });

  const rendered = render(<scene.Component model={scene} />);

  return { ...rendered, timeRange };
}

const openPicker = () => screen.getByTestId(selectors.components.TimePicker.openButton);

/**
 * SceneTimeRange normalizes every range it is handed to a pair of strings, so what tells a pinned range
 * from a sliding one is whether the string is still time math — not whether it is a dateTime.
 */
const isRelative = (raw: TimeRange['raw'][keyof TimeRange['raw']]) => /now/.test(String(raw));

/** The range the scene ends up holding — `state.from`/`state.to` being what the save model reads. */
function sceneRange(timeRange: SceneTimeRange) {
  const { from, to, value } = timeRange.state;

  return {
    rawFromIsRelative: isRelative(value.raw.from),
    rawToIsRelative: isRelative(value.raw.to),
    from: value.from.toISOString(),
    to: value.to.toISOString(),
    savedFrom: from,
    savedTo: to,
  };
}

describe('NotebookTimePicker', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-08-26T15:00:00Z'), advanceTimers: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

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

  it('writes the window typed into the form back to the scene', async () => {
    const { user, timeRange } = setup();

    await user.click(openPicker());
    await user.clear(await screen.findByTestId(selectors.components.TimePicker.fromField));
    await user.type(screen.getByTestId(selectors.components.TimePicker.fromField), '2026-08-20 00:00:00');
    await user.clear(screen.getByTestId(selectors.components.TimePicker.toField));
    await user.type(screen.getByTestId(selectors.components.TimePicker.toField), '2026-08-21 00:00:00');
    await user.click(screen.getByTestId(selectors.components.TimePicker.applyTimeRange));

    // The saved ends are ISO rather than 'now-6h': this is what buildTimeSettingsSpec reads.
    expect(sceneRange(timeRange)).toEqual({
      rawFromIsRelative: false,
      rawToIsRelative: false,
      from: '2026-08-20T00:00:00.000Z',
      to: '2026-08-21T00:00:00.000Z',
      savedFrom: '2026-08-20T00:00:00.000Z',
      savedTo: '2026-08-21T00:00:00.000Z',
    });
  });

  // Hiding the quick ranges does not stop someone typing `now-1h` into the form.
  it('pins a relative expression to a fixed window before recording it', async () => {
    const { user, timeRange } = setup();

    await user.click(openPicker());
    await user.clear(await screen.findByTestId(selectors.components.TimePicker.toField));
    await user.type(screen.getByTestId(selectors.components.TimePicker.toField), '2026-08-26 15:00:00');
    await user.clear(screen.getByTestId(selectors.components.TimePicker.fromField));
    await user.type(screen.getByTestId(selectors.components.TimePicker.fromField), 'now-1h');
    await user.click(screen.getByTestId(selectors.components.TimePicker.applyTimeRange));

    const recorded = sceneRange(timeRange);
    // Without the pin the notebook saves the string 'now-1h' and goes on sliding.
    expect(recorded.rawFromIsRelative).toBe(false);
    // To the second, because the fake clock advances while the form is being typed into.
    expect(recorded.savedFrom).toMatch(/^2026-08-26T14:00:0/);
  });

  // The two controls the toolbar picker has that the document one did not.
  it.each([
    ['moveBackwardButton', selectors.components.TimePicker.moveBackwardButton],
    ['zoomOut', selectors.components.TimePicker.zoomOut],
  ])('leaves the range absolute after %s', async (_name, testId) => {
    const { user, timeRange } = setup();

    await user.click(screen.getByTestId(testId));

    const recorded = sceneRange(timeRange);
    expect(recorded.rawFromIsRelative).toBe(false);
    expect(recorded.rawToIsRelative).toBe(false);
  });
});
