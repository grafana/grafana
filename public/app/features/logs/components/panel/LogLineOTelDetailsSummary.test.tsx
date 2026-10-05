import { render, screen } from '@testing-library/react';

import {
  createTheme,
  type DataFrame,
  type Field,
  FieldType,
  LogLevel,
  LogsSortOrder,
  type ScopedVars,
  toDataFrame,
} from '@grafana/data';

import { createLogLine } from '../mocks/logRow';

import { LogLineOTelDetailsSummary } from './LogLineOTelDetailsSummary';
import { LogListContext, type LogListContextData } from './LogListContext';
import { defaultValue } from './__mocks__/LogListContext';

jest.mock('./LogListContext');

const TIME_MS = 1786434504553;
const TIME_NS = '1786434504553123456';

function createLogWithLinks(logLevel: LogLevel = LogLevel.error) {
  const dataFrame = toDataFrame({
    fields: [
      { name: 'timestamp', type: FieldType.time, values: [TIME_MS] },
      { name: 'body', type: FieldType.string, values: ['request failed'] },
      {
        name: 'traceId',
        type: FieldType.string,
        values: ['abc'],
        config: { links: [{ title: 'Traces', url: 'https://example.com/trace' }] },
      },
      {
        name: 'service',
        type: FieldType.string,
        values: ['checkout'],
        config: { links: [{ title: 'Logs', url: 'https://example.com/logs' }] },
      },
    ],
  });

  return createLogLine(
    {
      dataFrame,
      entry: 'request failed',
      entryFieldIndex: 1,
      logLevel,
      rowIndex: 0,
      timeEpochMs: TIME_MS,
      timeEpochNs: TIME_NS,
    },
    {
      escape: false,
      getFieldLinks: (field: Field, rowIndex: number, _dataFrame: DataFrame, _vars: ScopedVars) => {
        return (field.config.links ?? []).map((link) => ({
          href: link.url,
          title: link.title,
          target: '_blank' as const,
          origin: field,
        }));
      },
      order: LogsSortOrder.Descending,
      timeZone: 'browser',
      wrapLogMessage: true,
    }
  );
}

function renderSummary(log = createLogWithLinks(), contextOverrides: Partial<LogListContextData> = {}) {
  return render(
    <LogListContext.Provider value={{ ...defaultValue, timestampResolution: 'ms', ...contextOverrides }}>
      <LogLineOTelDetailsSummary log={log} />
    </LogListContext.Provider>
  );
}

const theme = createTheme();

describe('LogLineOTelDetailsSummary', () => {
  it('shows the error level in a red badge, the millisecond timestamp, and each link', () => {
    const log = createLogWithLinks();
    renderSummary(log);

    expect(screen.getByText('Error').closest('div')).toHaveStyle({
      background: theme.components.badge.red.background,
      color: theme.components.badge.red.text,
    });
    expect(screen.getByText(log.timestamp)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Traces' })).toHaveAttribute('href', 'https://example.com/trace');
    expect(screen.getByRole('link', { name: 'Logs' })).toHaveAttribute('href', 'https://example.com/logs');
  });

  it('shows the nanosecond timestamp when that resolution is selected', () => {
    const log = createLogWithLinks();
    renderSummary(log, { timestampResolution: 'ns' });

    expect(screen.getByText(log.timestampNs)).toBeInTheDocument();
    expect(screen.queryByText(log.timestamp)).not.toBeInTheDocument();
  });

  it.each([
    [LogLevel.critical, 'Critical', 'purple'],
    [LogLevel.warning, 'Warning', 'orange'],
    [LogLevel.info, 'Info', 'blue'],
    [LogLevel.debug, 'Debug', 'darkgrey'],
  ] as const)('renders the %s level as %s in a %s badge', (logLevel, label, color) => {
    renderSummary(createLogWithLinks(logLevel));

    expect(screen.getByText(label).closest('div')).toHaveStyle({
      background: theme.components.badge[color].background,
      color: theme.components.badge[color].text,
    });
  });

  it('omits the level when the log level is unspecified', () => {
    const log = createLogWithLinks(LogLevel.unspecified);
    renderSummary(log);

    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
    expect(screen.getByText(log.timestamp)).toBeInTheDocument();
  });
});
