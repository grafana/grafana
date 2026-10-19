import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import { type TraceSpan } from '../../types/trace';

import { TraceBanner } from './TraceBanner';
import { type TraceBannerHighlight } from './findTraceBanner';

function createSpan(overrides: Partial<TraceSpan> = {}): TraceSpan {
  return {
    traceID: 'trace-1',
    spanID: 'span-1',
    operationName: 'HTTP POST',
    startTime: 1_000,
    duration: 18_600_000,
    logs: [],
    processID: 'proc-1',
    flags: 0,
    depth: 1,
    hasChildren: false,
    childSpanCount: 0,
    process: { serviceName: 'query.grafana.app', tags: [] },
    relativeStartTime: 0,
    tags: [
      { key: 'http.method', value: 'POST' },
      { key: 'http.route', value: '/apis/query.grafana.app/v0alpha1' },
      { key: 'http.status_code', value: '504' },
    ],
    references: [],
    warnings: [],
    childSpanIds: [],
    subsidiarilyReferencedBy: [],
    ...overrides,
  };
}

function renderBanner(span: TraceSpan, severity: TraceBannerHighlight['severity'] = 'error') {
  const onGoToSpan = jest.fn();
  const onLayoutChange = jest.fn();
  const view = render(
    <TraceBanner
      highlight={{ span, severity }}
      traceDuration={20_010_000}
      onGoToSpan={onGoToSpan}
      onLayoutChange={onLayoutChange}
    />
  );

  return {
    onGoToSpan,
    onLayoutChange,
    rerenderSpan(nextSpan: TraceSpan, nextSeverity: TraceBannerHighlight['severity'] = severity) {
      view.rerender(
        <TraceBanner
          highlight={{ span: nextSpan, severity: nextSeverity }}
          traceDuration={20_010_000}
          onGoToSpan={onGoToSpan}
          onLayoutChange={onLayoutChange}
        />
      );
    },
  };
}

describe('TraceBanner', () => {
  it('keeps exception details collapsed and reports every Go to span click', async () => {
    const user = userEvent.setup();
    const { onGoToSpan } = renderBanner(createSpan(exceptionLogs()));

    expect(screen.getByText('Error: 504')).toBeInTheDocument();
    expect(screen.getByText('query.grafana.app')).toBeInTheDocument();
    expect(screen.getByText('POST /apis/query.grafana.app/v0alpha1')).toBeInTheDocument();
    expect(screen.getByText('18.6 s · 93% of trace')).toBeInTheDocument();
    expect(screen.queryByText('java.lang.TimeoutException')).not.toBeInTheDocument();

    const goToSpan = screen.getByRole('button', { name: 'Go to span' });
    await user.click(goToSpan);
    await user.click(goToSpan);

    expect(onGoToSpan).toHaveBeenCalledTimes(2);
    expect(onGoToSpan).toHaveBeenCalledWith('span-1');
    expect(screen.queryByText('java.lang.TimeoutException')).not.toBeInTheDocument();
  });

  it('expands the exception and shows or hides the stacktrace', async () => {
    const user = userEvent.setup();
    const { onLayoutChange } = renderBanner(createSpan(exceptionLogs()));
    onLayoutChange.mockClear();

    await user.click(screen.getByTestId(selectors.components.TraceViewer.traceBanner.toggleButton));

    const typeLabel = screen.getByText('exception.type');
    const messageLabel = screen.getByText('exception.message');
    const fields = typeLabel.parentElement?.parentElement;

    expect(typeLabel).toBeInTheDocument();
    expect(screen.getByText('java.lang.TimeoutException')).toBeInTheDocument();
    expect(messageLabel).toBeInTheDocument();
    expect(fields).toBe(messageLabel.parentElement?.parentElement);
    expect(window.getComputedStyle(fields!).gridTemplateColumns).toBe('max-content minmax(0, 1fr)');
    expect(screen.getByText('alert rule query exceeded the 20 s evaluation timeout')).toBeInTheDocument();
    expect(screen.queryByText(/QueryRunner\.run/)).not.toBeInTheDocument();
    expect(onLayoutChange).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Show stacktrace/ }));

    const stacktrace = screen.getByText(/QueryRunner\.run/);
    expect(stacktrace).toBeInTheDocument();
    expect(window.getComputedStyle(stacktrace).maxHeight).toBe('300px');
    expect(window.getComputedStyle(stacktrace).overflowY).toBe('auto');
    expect(screen.getByText('exception.stacktrace')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Hide stacktrace/ }));

    expect(screen.queryByText(/QueryRunner\.run/)).not.toBeInTheDocument();
  });

  it.each([
    { name: 'trace', traceID: 'trace-2', spanID: 'span-1' },
    { name: 'span', traceID: 'trace-1', spanID: 'span-2' },
  ])('collapses an expanded exception when the highlighted $name changes', async ({ traceID, spanID }) => {
    const user = userEvent.setup();
    const { rerenderSpan } = renderBanner(createSpan(exceptionLogs()));

    await user.click(screen.getByTestId(selectors.components.TraceViewer.traceBanner.toggleButton));
    await user.click(screen.getByRole('button', { name: /Show stacktrace/ }));
    expect(screen.getByText(/QueryRunner\.run/)).toBeInTheDocument();

    rerenderSpan(createSpan({ ...exceptionLogs(), traceID, spanID }));

    expect(screen.getByText('Error: 504')).toBeInTheDocument();
    expect(screen.getByTestId(selectors.components.TraceViewer.traceBanner.toggleButton)).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByText('java.lang.TimeoutException')).not.toBeInTheDocument();

    await user.click(screen.getByTestId(selectors.components.TraceViewer.traceBanner.toggleButton));

    expect(screen.getByText('java.lang.TimeoutException')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show stacktrace/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/QueryRunner\.run/)).not.toBeInTheDocument();
  });

  it('does not offer details when the span has no exception', () => {
    renderBanner(createSpan());

    expect(screen.getByText('Error: 504')).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.TraceViewer.traceBanner.toggleButton)).not.toBeInTheDocument();
  });

  it('labels a client error as a warning', () => {
    renderBanner(
      createSpan({
        tags: [{ key: 'http.status_code', value: '404' }],
      }),
      'warning'
    );

    expect(screen.getByText('Warning: 404')).toBeInTheDocument();
    expect(screen.queryByText('Error: 404')).not.toBeInTheDocument();
  });
});

function exceptionLogs(): Partial<TraceSpan> {
  return {
    logs: [
      {
        timestamp: 10,
        name: 'exception',
        fields: [
          { key: 'exception.type', value: 'java.lang.TimeoutException' },
          { key: 'exception.message', value: 'alert rule query exceeded the 20 s evaluation timeout' },
          {
            key: 'exception.stacktrace',
            value:
              'java.util.concurrent.TimeoutException: alert rule query exceeded the 20 s evaluation timeout\nat com.grafana.ruler.eval.QueryRunner.run(QueryRunner.java:212)',
          },
        ],
      },
    ],
  };
}
