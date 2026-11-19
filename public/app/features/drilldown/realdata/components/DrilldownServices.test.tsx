import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { mockComboboxRect } from '@grafana/test-utils';

import { type Note, setOverview } from '../liveScenario';
import { type ChartState, loadServiceCharts } from '../serviceCharts';
import { emptyCharts, emptyOverview } from '../testFixtures';

import { DrilldownServices } from './DrilldownServices';

jest.mock('../serviceCharts', () => ({ loadServiceCharts: jest.fn() }));

mockComboboxRect();

const NAMES = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet'];

// The services whose name button is on the page, in page order.
const onPage = () => NAMES.filter((name) => screen.queryByRole('button', { name }));

const showMore = () => screen.queryByRole('button', { name: 'Show 4 more' });

// One point of a series, which is all the number on a card needs.
const data = (name: string, value: number, matched?: string): ChartState => ({
  kind: 'data',
  series: [{ name, times: [60000], values: [value] }],
  value: matched,
});

beforeEach(() => {
  // The charts stay loading unless a test lets them answer, so no state update lands outside the test.
  jest.mocked(loadServiceCharts).mockReturnValue(new Promise(() => {}));
  setOverview({ ...emptyOverview, services: NAMES, scopeValues: { ...emptyOverview.scopeValues, service: NAMES } });
});

afterEach(() => {
  jest.mocked(loadServiceCharts).mockReset();
  setOverview(emptyOverview);
});

describe('DrilldownServices', () => {
  it('shows 4 services, and each click on the button adds 4 more until none remain', async () => {
    const { user } = render(<DrilldownServices onPick={jest.fn()} appUrls={{}} />);
    expect(onPage()).toEqual(['alpha', 'bravo', 'charlie', 'delta']);

    await user.click(showMore()!);
    expect(onPage()).toEqual(NAMES.slice(0, 8));

    await user.click(showMore()!);
    expect(onPage()).toEqual(NAMES);
    expect(showMore()).not.toBeInTheDocument();
  });

  it('shows no button when every service fits in the first 4', () => {
    setOverview({ ...emptyOverview, services: NAMES.slice(0, 4) });

    render(<DrilldownServices onPick={jest.fn()} appUrls={{}} />);

    expect(onPage()).toEqual(NAMES.slice(0, 4));
    expect(showMore()).not.toBeInTheDocument();
  });

  it('asks for the charts of the services on show only', async () => {
    const { user } = render(<DrilldownServices onPick={jest.fn()} appUrls={{}} />);
    expect(loadServiceCharts).toHaveBeenCalledTimes(4);
    expect(loadServiceCharts).toHaveBeenCalledWith('alpha', undefined);

    await user.click(showMore()!);

    expect(loadServiceCharts).toHaveBeenCalledTimes(8);
    expect(loadServiceCharts).toHaveBeenCalledWith('hotel', undefined);
    expect(loadServiceCharts).not.toHaveBeenCalledWith('india', undefined);
  });

  it('asks for the charts of the chosen environment', () => {
    render(<DrilldownServices onPick={jest.fn()} appUrls={{}} />, {
      historyOptions: { initialEntries: ['/drilldown?var-environment=prod'] },
    });

    expect(loadServiceCharts).toHaveBeenCalledWith('alpha', 'prod');
  });

  it('opens the scope of a service from its name', async () => {
    const onPick = jest.fn();
    const { user } = render(<DrilldownServices onPick={onPick} appUrls={{}} />);

    await user.click(screen.getByRole('button', { name: 'bravo' }));

    expect(onPick).toHaveBeenCalledWith({ type: 'service', value: 'bravo' });
  });

  it('lists every service name in Browse, and opens the one picked', async () => {
    const onPick = jest.fn();
    const { user } = render(<DrilldownServices onPick={onPick} appUrls={{}} />);

    await user.click(screen.getByRole('button', { name: 'Browse all services' }));
    // The menu draws only the options in view, so the test narrows it to the one it wants.
    await user.type(screen.getByRole('combobox', { name: 'Scope value' }), 'juliet');
    await user.click(await screen.findByRole('option', { name: 'juliet' }));

    expect(onPick).toHaveBeenCalledWith({ type: 'service', value: 'juliet' });
  });

  it('says there are no services when Tempo holds none', () => {
    setOverview({ ...emptyOverview, services: [] });

    render(<DrilldownServices onPick={jest.fn()} appUrls={{}} />);

    expect(screen.getByText('No services found in traces in the last 30 minutes')).toBeInTheDocument();
    expect(loadServiceCharts).not.toHaveBeenCalled();
  });

  it('names the environment when the chosen environment holds no services', () => {
    setOverview({ ...emptyOverview, services: [] });

    render(<DrilldownServices onPick={jest.fn()} appUrls={{}} />, {
      historyOptions: { initialEntries: ['/drilldown?var-environment=prod'] },
    });

    expect(screen.getByText('No services found in traces for prod in the last 30 minutes')).toBeInTheDocument();
  });

  it('says traces were not measured, and does not say there are no services, when Tempo did not answer', () => {
    const notes: Note[] = [{ source: 'traces', message: 'Tempo answered 502' }];
    setOverview({ ...emptyOverview, services: [], notes });

    render(<DrilldownServices onPick={jest.fn()} appUrls={{}} />);

    expect(screen.getByText('Not measured: see the notice in the header')).toBeInTheDocument();
    expect(screen.queryByText('No services found in traces in the last 30 minutes')).not.toBeInTheDocument();
  });
});

describe('a service row', () => {
  it('has the traces panel and a card each for metrics, logs, profiles and SQL, as in the design', () => {
    render(<DrilldownServices onPick={jest.fn()} appUrls={{}} />);

    for (const title of ['Traces', 'Metrics', 'Logs', 'Profiles', 'SQL']) {
      expect(screen.getAllByText(title)).toHaveLength(4);
    }
    expect(screen.getAllByText('Requests per minute by status')).toHaveLength(4);
  });

  it('shows what each panel found once its charts load', async () => {
    jest.mocked(loadServiceCharts).mockResolvedValue(emptyCharts);

    render(<DrilldownServices onPick={jest.fn()} appUrls={{}} />);

    expect(await screen.findByText('No server or consumer spans for alpha in the last 30 minutes')).toBeInTheDocument();
    expect(screen.getByText('No p95 latency for alpha in the last 30 minutes')).toBeInTheDocument();
    expect(screen.getByText('No error lines found for alpha in the last 30 minutes')).toBeInTheDocument();
    expect(screen.getByText('No CPU profiles with service_name="alpha" in the last 30 minutes')).toBeInTheDocument();
    expect(screen.getByText('No error lines found for delta in the last 30 minutes')).toBeInTheDocument();
    expect(screen.queryByText('No error lines found for echo in the last 30 minutes')).not.toBeInTheDocument();
  });

  it('shows the number each card measures, with what it counts', async () => {
    jest.mocked(loadServiceCharts).mockResolvedValue({
      ...emptyCharts,
      metrics: data('p95', 1250),
      logs: data('errors', 110),
      profiles: data('cpu', 2.5),
    });

    render(<DrilldownServices onPick={jest.fn()} appUrls={{}} />);

    expect((await screen.findAllByText('1.25 s'))[0]).toBeInTheDocument();
    expect(screen.getAllByText('p95 latency')[0]).toBeInTheDocument();
    expect(screen.getAllByText('110')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Error lines per minute')[0]).toBeInTheDocument();
    expect(screen.getAllByText('2.5')[0]).toBeInTheDocument();
    expect(screen.getAllByText('CPU cores')[0]).toBeInTheDocument();
  });

  it('shows 0 error lines for a service that has lines and no errors', async () => {
    jest.mocked(loadServiceCharts).mockResolvedValue({ ...emptyCharts, logs: data('errors', 0) });

    render(<DrilldownServices onPick={jest.fn()} appUrls={{}} />);

    expect((await screen.findAllByText('0'))[0]).toBeInTheDocument();
  });

  it('says what the lookups after an empty panel found', async () => {
    jest.mocked(loadServiceCharts).mockResolvedValue({
      ...emptyCharts,
      traces: { kind: 'empty', reason: { type: 'no-server-spans', kinds: ['client', 'internal'] } },
      metrics: {
        kind: 'empty',
        reason: {
          type: 'no-series',
          metric: 'traces_spanmetrics_calls_total',
          label: 'service',
          otherMetrics: true,
          inJob: true,
        },
      },
      profiles: { kind: 'empty', reason: { type: 'outside-environment' }, value: 'alpha' },
    });

    render(<DrilldownServices onPick={jest.fn()} appUrls={{}} />, {
      historyOptions: { initialEntries: ['/drilldown?var-environment=prod'] },
    });

    expect(
      await screen.findByText(
        'No server or consumer spans for alpha in the last 30 minutes. Span kinds found: client, internal'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'No series with service="alpha" in traces_spanmetrics_calls_total in the last 30 minutes. Other metrics have service="alpha". It might exist under job.'
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText('CPU profiles exist for alpha, but none with cluster="prod"')).toHaveLength(4);
  });

  it('names the value a card queried when it is not the service name', async () => {
    jest.mocked(loadServiceCharts).mockImplementation(async (service) => ({
      ...emptyCharts,
      logs: data('errors', 4, `shop/${service}`),
      profiles: data('cpu', 1, service),
    }));

    render(<DrilldownServices onPick={jest.fn()} appUrls={{}} />);

    expect(await screen.findByText('Error lines per minute, from shop/alpha')).toBeInTheDocument();
    expect(screen.getByText('Error lines per minute, from shop/delta')).toBeInTheDocument();
    expect(screen.queryByText(/CPU cores, from/)).not.toBeInTheDocument();
  });

  it('gives the traces panel a header action and each card an arrow that open the Drilldown app', async () => {
    jest.mocked(loadServiceCharts).mockResolvedValue({ ...emptyCharts, logs: data('errors', 2, 'shop/alpha') });

    render(
      <DrilldownServices
        onPick={jest.fn()}
        appUrls={{
          traces: '/a/grafana-exploretraces-app/explore',
          logs: '/a/grafana-lokiexplore-app/explore',
        }}
      />
    );

    const logs = await screen.findAllByRole('link', { name: 'Open in Logs' });

    expect(logs).toHaveLength(4);
    expect(logs[0]).toHaveAttribute(
      'href',
      expect.stringContaining('/a/grafana-lokiexplore-app/explore/service/shop-alpha/logs')
    );
    expect(screen.getAllByRole('link', { name: 'View traces' })).toHaveLength(4);
    expect(screen.queryByRole('link', { name: 'Open in Metrics' })).not.toBeInTheDocument();
  });

  it('has no Logs or Profiles arrow for a service with no value there, and keeps the Metrics arrow', async () => {
    jest.mocked(loadServiceCharts).mockResolvedValue({
      ...emptyCharts,
      logs: { kind: 'empty', reason: { type: 'no-value' } },
      profiles: { kind: 'empty', reason: { type: 'no-value' } },
    });

    render(
      <DrilldownServices
        onPick={jest.fn()}
        appUrls={{
          logs: '/a/grafana-lokiexplore-app/explore',
          profiles: '/a/grafana-pyroscope-app/explore',
          metrics: '/a/grafana-metricsdrilldown-app/drilldown',
        }}
      />
    );

    await screen.findByText('No Loki service_name equals alpha or ends with /alpha in the last 30 minutes');
    expect(screen.queryByRole('link', { name: 'Open in Logs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open in Profiles' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Open in Metrics' })).toHaveLength(4);
  });

  it('says SQL is not set up until a SQL data source is chosen, and that nothing queries it after', () => {
    const { unmount } = render(<DrilldownServices onPick={jest.fn()} appUrls={{}} />);

    expect(screen.getAllByText('Not set up yet')).toHaveLength(4);
    unmount();

    render(<DrilldownServices onPick={jest.fn()} appUrls={{}} />, {
      historyOptions: { initialEntries: ['/drilldown?var-ds-sql=orders'] },
    });

    expect(screen.getAllByText('Not measured: nothing queries SQL yet')).toHaveLength(4);
  });
});
