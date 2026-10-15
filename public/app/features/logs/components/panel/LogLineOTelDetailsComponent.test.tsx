import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { dateTime, type TimeRange } from '@grafana/data';

import { OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME } from '../fieldSelector/logFields';
import { createLogLine } from '../mocks/logRow';

import { LogLineDetailsOTelComponent } from './LogLineOTelDetailsComponent';
import { LogListContext, type LogListContextData } from './LogListContext';
import { defaultValue } from './__mocks__/LogListContext';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginLinks: jest.fn().mockReturnValue({ isLoading: false, links: [] }),
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

function renderDetails(contextOverrides: Partial<LogListContextData> = {}) {
  const log = createLog();

  return render(
    <LogListContext.Provider value={{ ...defaultValue, logOptionsStorageKey: STORAGE_KEY, ...contextOverrides }}>
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
