import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CoreApp, type GrafanaTheme, type GrafanaTheme2, toUtc } from '@grafana/data';
import { config, reportInteraction, type TemplateSrv } from '@grafana/runtime';
import type { Themeable } from '@grafana/ui/types';

import QueryField from './QueryField';
import { createTempoDatasource } from './test/mocks';
import { type TempoQuery } from './types';

jest.mock('@grafana/assistant', () => ({
  QueryWithAssistantButton: () => <div data-testid="query-with-assistant-button" />,
}));

jest.mock('./SearchTraceQLEditor/TraceQLSearch', () => ({
  __esModule: true,
  default: () => <div data-testid="traceql-search-editor" />,
}));

jest.mock('./ServiceGraphSection', () => ({
  ServiceGraphSection: () => <div data-testid="service-graph-section" />,
}));

jest.mock('./traceql/QueryEditor', () => ({
  QueryEditor: () => <div data-testid="traceql-editor" />,
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('@grafana/ui', () => {
  const actual = jest.requireActual('@grafana/ui');

  return {
    ...actual,
    Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
      <button onClick={onClick} type="button">
        {children}
      </button>
    ),
    FileDropzone: ({ onLoad }: { onLoad: (result: string | null) => void }) => (
      <button onClick={() => onLoad('{"trace":"uploaded"}')} type="button">
        Mock file dropzone
      </button>
    ),
    InlineField: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    InlineFieldRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Modal: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
      isOpen ? <div>{children}</div> : null,
    RadioButtonGroup: ({
      options,
      onChange,
    }: {
      options: Array<{ label?: string; value?: string }>;
      onChange: (value: string) => void;
    }) => (
      <div>
        {options.map((option) => (
          <button key={option.value} onClick={() => option.value && onChange(option.value)} type="button">
            {option.label}
          </button>
        ))}
      </div>
    ),
    Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    withTheme2: (Component: React.ComponentType<Partial<Themeable>>) => (props: Record<string, unknown>) => (
      <Component
        {...props}
        theme={
          {
            spacing: (value: number) => `${value * 8}px`,
          } as unknown as GrafanaTheme2 & GrafanaTheme
        }
      />
    ),
  };
});

const mockedReportInteraction = jest.mocked(reportInteraction);

describe('QueryField', () => {
  const range = {
    from: toUtc('2024-01-01T00:00:00Z'),
    to: toUtc('2024-01-01T01:00:00Z'),
    raw: {
      from: toUtc('2024-01-01T00:00:00Z'),
      to: toUtc('2024-01-01T01:00:00Z'),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    config.featureToggles.queryWithAssistant = true;
    config.buildInfo.version = '11.0.0';
  });

  function renderQueryField(
    overrides: Partial<React.ComponentProps<typeof QueryField>> = {},
    nativeHistograms = false
  ) {
    const datasource = createTempoDatasource({} as unknown as TemplateSrv);
    jest.spyOn(datasource, 'getNativeHistograms').mockResolvedValue(nativeHistograms);

    const props = {
      app: CoreApp.Explore,
      datasource,
      onBlur: jest.fn(),
      onChange: jest.fn(),
      onRunQuery: jest.fn(),
      query: { refId: 'A', queryType: 'traceql' } as TempoQuery,
      range,
      ...overrides,
    };

    return {
      ...render(<QueryField {...props} />),
      datasource,
      props,
    };
  }

  it('sets the default query type on mount when it is missing', async () => {
    const onChange = jest.fn();

    const { datasource } = renderQueryField({
      onChange,
      query: { refId: 'A' } as TempoQuery,
    });

    await waitFor(() => expect(datasource.getNativeHistograms).toHaveBeenCalledWith(range));

    expect(onChange).toHaveBeenNthCalledWith(1, { refId: 'A', queryType: 'traceql' });
    expect(onChange).toHaveBeenNthCalledWith(2, { refId: 'A', serviceMapUseNativeHistograms: false });
  });

  it('runs the query when a service graph query migrates to native histograms', async () => {
    const onRunQuery = jest.fn();
    const query = { refId: 'A', queryType: 'serviceMap' } as TempoQuery;

    renderQueryField(
      {
        onRunQuery,
        query,
      },
      true
    );

    await waitFor(() => expect(onRunQuery).toHaveBeenCalled());
  });

  it('clears results, updates the query type, and reports the interaction when switching query type', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const onRunQuery = jest.fn();

    renderQueryField({
      onChange,
      onRunQuery,
      query: { refId: 'A', queryType: 'traceql' } as TempoQuery,
    });

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ refId: 'A', queryType: 'traceql', serviceMapUseNativeHistograms: false })
    );
    onChange.mockClear();
    onRunQuery.mockClear();

    await user.click(screen.getByRole('button', { name: 'Service Graph' }));

    expect(onChange).toHaveBeenNthCalledWith(1, { refId: 'A', queryType: 'clear' });
    expect(onRunQuery).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenNthCalledWith(2, { refId: 'A', queryType: 'serviceMap' });
    expect(mockedReportInteraction).toHaveBeenCalledWith('grafana_traces_query_type_changed', {
      datasourceType: 'tempo',
      app: CoreApp.Explore,
      grafana_version: '11.0.0',
      newQueryType: 'serviceMap',
      previousQueryType: 'traceql',
    });
  });

  it('shows the assistant button only in supported apps', () => {
    const { rerender } = renderQueryField({ app: CoreApp.Explore });

    expect(screen.getByTestId('query-with-assistant-button')).toBeInTheDocument();

    rerender(
      <QueryField
        app={CoreApp.UnifiedAlerting}
        datasource={createTempoDatasource({} as unknown as TemplateSrv)}
        onBlur={jest.fn()}
        onChange={jest.fn()}
        onRunQuery={jest.fn()}
        query={{ refId: 'A', queryType: 'traceql' } as TempoQuery}
        range={range}
      />
    );

    expect(screen.queryByTestId('query-with-assistant-button')).not.toBeInTheDocument();
  });

  it('does not show the assistant button when the feature toggle is disabled', () => {
    config.featureToggles.queryWithAssistant = false;

    renderQueryField({ app: CoreApp.Explore });

    expect(screen.queryByTestId('query-with-assistant-button')).not.toBeInTheDocument();
  });

  it('uploads a trace, switches to upload mode, and runs the query', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const onRunQuery = jest.fn();
    const query = { refId: 'A', queryType: 'traceql' } as TempoQuery;

    const { datasource } = renderQueryField({
      onChange,
      onRunQuery,
      query,
    });

    await user.click(screen.getByRole('button', { name: 'Import trace' }));
    await user.click(screen.getByRole('button', { name: 'Mock file dropzone' }));

    expect(datasource.uploadedJson).toBe('{"trace":"uploaded"}');
    expect(onChange).toHaveBeenLastCalledWith({ refId: 'A', queryType: 'upload' });
    expect(onRunQuery).toHaveBeenCalledTimes(1);
  });
});
