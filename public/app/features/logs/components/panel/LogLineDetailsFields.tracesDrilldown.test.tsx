import { render, screen } from '@testing-library/react';

import {
  CoreApp,
  dateTime,
  type Field,
  FieldType,
  type LinkModel,
  PluginExtensionPoints,
  PluginExtensionTypes,
  type TimeRange,
} from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

import { type FieldDef } from '../logParser';
import { createLogLine } from '../mocks/logRow';

import { LogLineDetailsFields } from './LogLineDetailsFields';
import { LogLineDetailsLinks } from './LogLineDetailsLinks';
import { LogListContext, type LogListContextData } from './LogListContext';
import { defaultValue } from './__mocks__/LogListContext';

jest.mock('./LogListContext');

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginLinks: jest.fn(),
}));

const TRACE_ID = '2203801e0171aa8b';
const TRACES_PATH = '/a/grafana-exploretraces-app/explore?var-ds=tempo-uid';

const tempoLink: LinkModel<Field> = {
  href: '/explore?left=abc',
  title: 'tempo',
  target: '_self' as const,
  onClick: jest.fn(),
  origin: {
    name: '',
    type: FieldType.time,
    config: {},
    values: [],
  },
  interpolatedParams: {
    query: {
      refId: 'A',
      datasource: { uid: 'tempo-uid' },
      query: TRACE_ID,
      queryType: 'traceql',
    } as DataQuery,
    timeRange: {
      from: dateTime('2026-01-01T00:00:00Z'),
      to: dateTime('2026-01-01T01:00:00Z'),
      raw: { from: 'now-1h', to: 'now' },
    } satisfies TimeRange,
  },
};

const field: FieldDef = {
  keys: ['traceId'],
  values: [TRACE_ID],
  links: [tempoLink],
  fieldIndex: 1,
};

const drilldownContext: LogListContextData = { ...defaultValue, app: CoreApp.Unknown };

function renderFields(context: LogListContextData = drilldownContext) {
  const log = createLogLine();
  return render(
    <LogListContext.Provider value={context}>
      <LogLineDetailsFields fields={[field]} log={log} logs={[log]} />
    </LogListContext.Provider>
  );
}

describe('log line trace links in Logs Drilldown', () => {
  beforeEach(() => {
    jest.mocked(usePluginLinks).mockClear();
    jest.mocked(usePluginLinks).mockReturnValue({
      isLoading: false,
      links: [
        {
          id: 'traces',
          type: PluginExtensionTypes.link,
          pluginId: 'grafana-exploretraces-app',
          title: 'Open in Grafana Traces Drilldown',
          description: '',
          path: TRACES_PATH,
        },
      ],
    });
  });

  it('opens the trace in Traces Drilldown when that extension is available', () => {
    renderFields();

    expect(usePluginLinks).toHaveBeenCalledWith({
      extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
      limitPerPlugin: 1,
      context: {
        targets: [
          {
            refId: 'A',
            datasource: { uid: 'tempo-uid', type: 'tempo' },
            query: TRACE_ID,
            queryType: 'traceql',
          },
        ],
        timeRange: { from: 'now-1h', to: 'now' },
      },
    });
    const link = screen.getByRole('link', { name: 'View in Traces Drilldown' });
    expect(link).toHaveAttribute('href', `${TRACES_PATH}&traceId=${TRACE_ID}`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveTextContent(TRACE_ID);
  });

  it('keeps the Explore link when the Traces Drilldown extension is missing', () => {
    jest.mocked(usePluginLinks).mockReturnValue({ isLoading: false, links: [] });

    renderFields();

    expect(screen.getByRole('link', { name: 'tempo' })).toHaveAttribute('href', '/explore?left=abc');
  });

  it('keeps the Explore link outside Logs Drilldown', () => {
    renderFields(defaultValue);

    expect(usePluginLinks).not.toHaveBeenCalled();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/explore?left=abc');
  });

  it('opens the derived-field trace button in Traces Drilldown', () => {
    const log = createLogLine();
    render(
      <LogListContext.Provider value={drilldownContext}>
        <LogLineDetailsLinks fields={[field]} log={log} logs={[log]} />
      </LogListContext.Provider>
    );

    const link = screen.getByRole('link', { name: 'View in Traces Drilldown' });
    expect(link).toHaveAttribute('href', `${TRACES_PATH}&traceId=${TRACE_ID}`);
    expect(link).toHaveAttribute('target', '_blank');
  });
});
