import { render, screen, waitFor } from '@testing-library/react';

import {
  AbsoluteTimeRange,
  EventBusSrv,
  FieldConfigSource,
  LoadingState,
  LogsSortOrder,
  PanelData,
  toUtc,
} from '@grafana/data';
import { mockTransformationsRegistry, organizeFieldsTransformer } from '@grafana/data/internal';
import { Options } from 'app/plugins/panel/logstable/options/types';

import { FIELD_SELECTOR_MIN_WIDTH } from '../../logs/components/fieldSelector/FieldSelector';
import { extractFieldsTransformer } from '../../transformers/extractFields/extractFields';

import { ExploreLogsTable } from './ExploreLogsTable';
import { getMockLokiFrame, getMockLokiFrameDataPlane } from './utils/mocks';

// Mock TableNG to disable virtualization, otherwise the lack of viewport in our testing env will cause the table to only render a single column
jest.mock('@grafana/ui/unstable', () => {
  const actual = jest.requireActual('@grafana/ui/unstable');
  const MockTableNG = actual.TableNG;
  return {
    ...actual,
    TableNG: (props: React.ComponentProps<typeof MockTableNG>) => (
      <MockTableNG {...props} enableVirtualization={false} />
    ),
  };
});

const publishMockFn = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: jest.fn(() => ({
    publish: publishMockFn,
  })),
}));

const mockGetUrlSearchParams = jest.fn(() => {
  return {};
});
jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  urlUtil: {
    getUrlSearchParams: () => mockGetUrlSearchParams(),
  },
}));

describe('ExploreLogsTable', () => {
  let origResizeObserver = global.ResizeObserver;
  let origScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
  let jestScrollIntoView = jest.fn();

  const setUp = (props?: Partial<React.ComponentProps<typeof ExploreLogsTable>>) => {
    return (
      <ExploreLogsTable
        data={panelData}
        width={100}
        timeZone={'UTC'}
        externalOptions={{
          frameIndex: 0,
        }}
        buildLinkToLogLine={buildLinkToLogLine}
        eventBus={new EventBusSrv()}
        height={100}
        onOptionsChange={function (options: Options): void {
          throw new Error('Function not implemented.');
        }}
        onFieldConfigChange={function (config: FieldConfigSource): void {
          throw new Error('Function not implemented.');
        }}
        onChangeTimeRange={function (range: AbsoluteTimeRange): void {
          throw new Error('Function not implemented.');
        }}
        onClickFilterLabel={undefined}
        onClickFilterOutLabel={undefined}
        {...props}
      />
    );
  };

  beforeAll(() => {
    mockTransformationsRegistry([organizeFieldsTransformer, extractFieldsTransformer]);
  });

  beforeEach(() => {
    jestScrollIntoView = jest.fn();
    origResizeObserver = global.ResizeObserver;
    origScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
      callback: unknown;
      constructor(callback: unknown) {
        this.callback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    window.HTMLElement.prototype.scrollIntoView = jestScrollIntoView;
  });

  afterEach(() => {
    global.ResizeObserver = origResizeObserver;
    window.HTMLElement.prototype.scrollIntoView = origScrollIntoView;
  });

  const panelData: PanelData = {
    state: LoadingState.Loading,
    series: [getMockLokiFrame()],
    timeRange: {
      from: toUtc('2019-01-01 10:00:00'),
      to: toUtc('2019-01-01 16:00:00'),
      raw: { from: 'now-1h', to: 'now' },
    },
  };

  const buildLinkToLogLine = jest.fn();

  it('should render', async () => {
    const { container } = render(setUp());
    await waitFor(() => expect(screen.queryByText('Selected fields')).toBeInTheDocument());
    const headers = container.querySelectorAll('[role="columnheader"]');
    expect(headers).toHaveLength(2);
    expect(headers[0].textContent).toBe('Time');
    expect(headers[1].textContent).toBe('Line');
  });

  describe('options', () => {
    it('Should respect options.displayedFields', async () => {
      const { container } = render(
        setUp({
          externalOptions: {
            frameIndex: 0,
            displayedFields: ['cluster', 'container'],
          },
        })
      );
      await waitFor(() => expect(screen.queryByText('Selected fields')).toBeInTheDocument());
      const headers = container.querySelectorAll('[role="columnheader"]');
      expect(headers).toHaveLength(2);
      expect(headers[0].textContent).toBe('cluster');
      expect(headers[1].textContent).toBe('container');
      expect(container.querySelector('[aria-selected="true"]')).not.toBeInTheDocument();
    });

    it('Should pull selected line from url params', async () => {
      mockGetUrlSearchParams.mockImplementationOnce(() => {
        return { selectedLine: [JSON.stringify({ id: '1697560998869868000_eeb96c0f', row: 0 })] };
      });

      const { container } = render(setUp());

      await waitFor(() => expect(screen.queryByText('Selected fields')).toBeInTheDocument());
      expect(container.querySelector('[aria-selected="true"]')).toBeVisible();
    });

    it('Should respect options.permalinkedLogId', async () => {
      const { container } = render(
        setUp({
          externalOptions: {
            frameIndex: 0,
            permalinkedLogId: '1697560998869868000_eeb96c0f',
          },
        })
      );

      await waitFor(() => expect(screen.queryByText('Selected fields')).toBeInTheDocument());
      expect(container.querySelector('[aria-selected="true"]')).toBeVisible();
    });

    it.each([LogsSortOrder.Ascending, LogsSortOrder.Descending])(
      'Should respect logs sort order (options.sortOrder)',
      async (sortOrder: LogsSortOrder) => {
        render(
          setUp({
            externalOptions: {
              frameIndex: 0,
              sortOrder,
            },
          })
        );

        await waitFor(() => expect(screen.queryByText('Selected fields')).toBeInTheDocument());
        expect(
          screen.getByLabelText(
            sortOrder === LogsSortOrder.Ascending ? /Sorted by oldest logs first/ : /Sorted by newest logs first/
          )
        ).toBeInTheDocument();
      }
    );

    it.each([true, false])('Should respect options.sortBy', async (desc: boolean) => {
      const { container } = render(
        setUp({
          externalOptions: {
            frameIndex: 0,
            displayedFields: ['cluster', 'container'],
            sortBy: [{ displayName: 'cluster', desc }],
          },
        })
      );

      await waitFor(() => expect(screen.queryByText('Selected fields')).toBeInTheDocument());
      const headers = container.querySelectorAll('[role="columnheader"]');
      expect(headers).toHaveLength(2);
      expect(headers[0].textContent).toBe('cluster');
      expect(headers[1].textContent).toBe('container');
      expect(headers[0]).toHaveAttribute('aria-sort', desc ? 'descending' : 'ascending');
    });

    it('Should respect options.frameIndex', async () => {
      const data: PanelData = {
        state: LoadingState.Loading,
        series: [getMockLokiFrame(), getMockLokiFrameDataPlane()],
        timeRange: {
          from: toUtc('2019-01-01 10:00:00'),
          to: toUtc('2019-01-01 16:00:00'),
          raw: { from: 'now-1h', to: 'now' },
        },
      };

      const { container } = render(
        setUp({
          data,
          externalOptions: {
            frameIndex: 1,
          },
        })
      );

      await waitFor(() => expect(screen.queryByText('Selected fields')).toBeInTheDocument());
      const headers = container.querySelectorAll('[role="columnheader"]');
      expect(headers).toHaveLength(2);
      expect(headers[0].textContent).toBe('timestamp');
      expect(headers[1].textContent).toBe('body');
    });

    it.each([0, 200])('Should respect options.fieldSelectorWidth', async (fieldSelectorWidth: number) => {
      render(
        setUp({
          externalOptions: {
            frameIndex: 0,
            fieldSelectorWidth,
          },
        })
      );

      await waitFor(() =>
        expect(
          screen.queryByLabelText(fieldSelectorWidth < FIELD_SELECTOR_MIN_WIDTH ? 'Expand sidebar' : 'Collapse sidebar')
        ).toBeInTheDocument()
      );
    });
  });
});
