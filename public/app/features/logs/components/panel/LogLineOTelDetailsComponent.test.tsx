import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';

import {
  dateTime,
  FieldType,
  LogsSortOrder,
  toDataFrame,
  type DataSourceApi,
  type Field,
  type TimeRange,
} from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime';

import { OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME } from '../fieldSelector/logFields';
import { createLogLine } from '../mocks/logRow';

import { LogLineDetailsOTelComponent } from './LogLineOTelDetailsComponent';
import { LogListContext, type LogListContextData } from './LogListContext';
import { defaultValue } from './__mocks__/LogListContext';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginLinks: jest.fn().mockReturnValue({ isLoading: false, links: [] }),
  getDataSourceInstance: jest.fn(),
}));

jest.mock('./LogListContext');

const STORAGE_KEY = 'otel-log-details-test';

const timeRange: TimeRange = {
  from: dateTime('2026-01-01T00:00:00Z'),
  to: dateTime('2026-01-01T01:00:00Z'),
  raw: { from: 'now-1h', to: 'now' },
};

function createLog() {
  return createLogLine({
    labels: {
      'service.name': 'checkout',
      'http.method': 'GET',
    },
  });
}

function createLogWithTrace() {
  return createLogLine(
    {
      labels: { 'service.name': 'checkout' },
      dataFrame: toDataFrame({
        refId: 'A',
        fields: [
          { name: 'Time', type: FieldType.time, values: [1] },
          { name: 'Line', type: FieldType.string, values: ['log message 1'] },
          { name: 'labels', type: FieldType.other, values: [{ 'service.name': 'checkout' }] },
          {
            name: 'traceId',
            type: FieldType.string,
            values: ['abcd1234'],
            config: { links: [{ title: 'tempo', url: '' }] },
          },
        ],
      }),
    },
    {
      escape: false,
      order: LogsSortOrder.Descending,
      timeZone: 'browser',
      wrapLogMessage: true,
      getFieldLinks: (field: Field) => {
        if (!field.config?.links?.length) {
          return [];
        }
        return [
          {
            href: '/explore',
            interpolatedParams: {
              query: {
                datasource: { uid: 'tempo-uid' },
                refId: 'A',
                query: 'abcd1234',
                queryType: 'traceql',
              },
            },
            title: 'tempo',
            target: '_blank',
            origin: field,
          },
        ];
      },
    }
  );
}

function renderDetails(
  contextOverrides: Partial<LogListContextData> = {},
  { log = createLog(), setPrettifyDetailsJSON = () => undefined, prettifyDetailsJSON = false } = {}
) {
  return render(
    <LogListContext.Provider value={{ ...defaultValue, logOptionsStorageKey: STORAGE_KEY, ...contextOverrides }}>
      <LogLineDetailsOTelComponent
        log={log}
        logs={[log]}
        prettifyDetailsJSON={prettifyDetailsJSON}
        setPrettifyDetailsJSON={setPrettifyDetailsJSON}
        timeRange={timeRange}
        timeZone="browser"
      />
    </LogListContext.Provider>
  );
}

describe('LogLineDetailsOTelComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('remembers which categories are open and closed', async () => {
    const user = userEvent.setup();
    let view = renderDetails();

    expect(screen.getByRole('button', { name: /Service/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /HTTP/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('checkout')).toBeInTheDocument();
    expect(screen.getByText('GET')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Service/ }));

    expect(screen.getByRole('button', { name: /Service/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('checkout')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /HTTP/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('GET')).toBeInTheDocument();

    view.unmount();
    view = renderDetails();

    expect(screen.getByRole('button', { name: /Service/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('checkout')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /HTTP/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('GET')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Service/ }));

    view.unmount();
    view = renderDetails();

    expect(screen.getByRole('button', { name: /Service/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('checkout')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /HTTP/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('GET')).toBeInTheDocument();
  });

  it('shows the log line in a collapsible section without a category icon', async () => {
    const user = userEvent.setup();
    const view = renderDetails({ syntaxHighlighting: false });

    const logLine = screen.getByRole('button', { name: 'Log line' });
    expect(logLine).toHaveAttribute('aria-expanded', 'false');
    expect(logLine.querySelectorAll('svg')).toHaveLength(1);
    expect(logLine.querySelector('svg')).toHaveAttribute('data-testid', 'icon-angle-right');
    expect(screen.queryByText('log message 1')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Service/ }).querySelectorAll('svg').length).toBeGreaterThan(1);

    await user.click(logLine);

    expect(screen.getByRole('button', { name: 'Log line' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('log message 1')).toBeInTheDocument();
    expect(screen.getByText('checkout')).toBeInTheDocument();

    view.unmount();
    renderDetails({ syntaxHighlighting: false });

    expect(screen.getByRole('button', { name: 'Log line' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('log message 1')).toBeInTheDocument();
  });

  it('collapses every section when syntax highlighting is unavailable', async () => {
    const user = userEvent.setup();
    const view = renderDetails({ syntaxHighlighting: false });

    await user.click(screen.getByRole('button', { name: 'Log line' }));
    expect(screen.getByRole('button', { name: 'Log line' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('log message 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Service/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('checkout')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /HTTP/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('GET')).toBeInTheDocument();

    view.unmount();
    renderDetails({ syntaxHighlighting: false, syntaxHighlightingUnavailable: true });

    expect(screen.getByRole('button', { name: 'Log line' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('log message 1')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Service/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('checkout')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /HTTP/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('GET')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Service/ }));

    expect(screen.getByRole('button', { name: /Service/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('checkout')).toBeInTheDocument();
  });

  it('prettifies a JSON log line from the log line section', async () => {
    const user = userEvent.setup();
    const setPrettifyDetailsJSON = jest.fn();
    const log = createLogLine({
      entry: '{"level":"info"}',
      labels: { 'service.name': 'checkout' },
    });

    renderDetails({ syntaxHighlighting: false }, { log, prettifyDetailsJSON: false, setPrettifyDetailsJSON });

    expect(screen.getByRole('button', { name: 'Log line' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('switch', { name: 'Prettify' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Log line' }));

    expect(screen.getByText('{"level":"info"}')).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Prettify' }));

    expect(setPrettifyDetailsJSON).toHaveBeenCalledTimes(1);
    expect(setPrettifyDetailsJSON).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: 'Log line' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('{"level":"info"}')).toBeInTheDocument();
  });

  it('does not show a trace section when the log has no trace link', () => {
    renderDetails();

    expect(screen.getByRole('button', { name: 'Log line' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trace' })).not.toBeInTheDocument();
  });

  it('loads the linked trace when the trace section is opened', async () => {
    const user = userEvent.setup();
    const query = jest.fn().mockReturnValue(of({ data: [] }));
    jest.mocked(getDataSourceInstance).mockResolvedValue({ uid: 'tempo-uid', query } as unknown as DataSourceApi);

    renderDetails({ syntaxHighlighting: false }, { log: createLogWithTrace() });

    const traceSection = screen.getByRole('button', { name: 'Trace' });
    expect(traceSection).toHaveAttribute('aria-expanded', 'false');
    expect(traceSection.querySelectorAll('svg')).toHaveLength(1);
    expect(query).not.toHaveBeenCalled();

    await user.click(traceSection);

    expect(await screen.findByText('Could not retrieve trace.')).toBeInTheDocument();
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: [expect.objectContaining({ query: 'abcd1234', queryType: 'traceql' })],
      })
    );
    expect(screen.getByRole('button', { name: 'Trace' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not display the synthetic OTel log attributes field', () => {
    const log = createLogLine({
      labels: {
        'service.name': 'checkout',
        [OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME]: 'field=synthetic-attributes-value',
      },
    });

    render(
      <LogListContext.Provider value={{ ...defaultValue, logOptionsStorageKey: STORAGE_KEY }}>
        <LogLineDetailsOTelComponent
          log={log}
          logs={[log]}
          prettifyDetailsJSON={false}
          setPrettifyDetailsJSON={() => undefined}
          timeRange={timeRange}
          timeZone="browser"
        />
      </LogListContext.Provider>
    );

    expect(screen.getByText('checkout')).toBeInTheDocument();
    expect(screen.queryByText('Log attributes')).not.toBeInTheDocument();
    expect(screen.queryByText(OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME)).not.toBeInTheDocument();
    expect(screen.queryByText('field=synthetic-attributes-value')).not.toBeInTheDocument();
  });
});
