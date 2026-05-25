import { act, screen, waitFor } from '@testing-library/react';

import {
  type DataSourceApi,
  type DataSourceJsonData,
  type DataTransformerInfo,
  type TransformerRegistryItem,
} from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

import { QueryEditorType } from '../constants';

import { QueryEditorContent } from './QueryEditorContent';
import { type QueryEditorUIState, type StackedEditorItem, type StackedEditorState } from './QueryEditorContext';
import { ds1SettingsMock, renderWithQueryEditorProvider } from './testUtils';
import { type Transformation } from './types';

jest.mock('app/features/query/components/QueryEditorRow', () => ({
  filterPanelDataToQuery: jest.fn((_data, refId) => ({ timeRange: { from: 0, to: 1 }, series: [], refId })),
}));

jest.mock('app/features/query/components/QueryErrorAlert', () => ({
  QueryErrorAlert: ({ error }: { error: Error }) => <div data-testid="query-error-alert">{error.message}</div>,
}));

jest.mock('./Header/ContentHeader', () => ({
  ContentHeaderSceneWrapper: () => <div data-testid="content-header" />,
}));

function MockQueryEditor({ query, onChange }: { query: DataQuery; onChange: (query: DataQuery) => void }) {
  return (
    <div data-testid={`query-editor-${query.refId}`}>
      <span>Editor {query.refId}</span>
      <button onClick={() => onChange({ ...query, hide: true })}>Change {query.refId}</button>
    </div>
  );
}

const mockDatasource: Partial<DataSourceApi<DataQuery, DataSourceJsonData>> = {
  components: { QueryEditor: MockQueryEditor },
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    defaultDatasource: 'test',
  },
  getDataSourceSrv: () => ({
    getInstanceSettings: () => ds1SettingsMock,
    get: () => Promise.resolve(mockDatasource),
  }),
}));

jest.mock('./TransformationEditor', () => ({
  TransformationEditor: ({ transformation }: { transformation: Transformation }) => (
    <div data-testid={`transformation-editor-${transformation.transformId}`}>
      Transformation {transformation.transformId}
    </div>
  ),
}));

jest.mock('./TransformationHelpDisplay', () => ({
  TransformationHelpDisplay: () => null,
}));

jest.mock('./TransformationDebugDisplay', () => ({
  TransformationDebugDisplay: () => null,
}));

jest.mock('./TransformationFilterDisplay', () => ({
  TransformationFilterDisplay: () => <div data-testid="transformation-filter-display" />,
  TransformationFilterEditor: () => <div data-testid="transformation-filter-display" />,
}));

const queries: DataQuery[] = [
  { refId: 'A', datasource: { type: 'test', uid: 'test' } },
  { refId: 'B', datasource: { type: 'test', uid: 'test' } },
];

const mockTransformationInfo: DataTransformerInfo = {
  id: 'organize',
  name: 'Organize fields',
  operator: jest.fn(),
};

const mockRegistryItem: TransformerRegistryItem = {
  id: 'organize',
  name: 'Organize fields',
  transformation: () => Promise.resolve(mockTransformationInfo),
  editor: () => null,
  imageDark: '',
  imageLight: '',
};

const transformations: Transformation[] = [
  {
    transformId: 'organize-0',
    transformConfig: { id: 'organize', options: {} },
    registryItem: mockRegistryItem,
  },
];

function stackedModeOverrides(overrides: Partial<StackedEditorState> = {}): StackedEditorState {
  return {
    enabled: true,
    enter: jest.fn(),
    exit: jest.fn(),
    syncActiveItem: jest.fn(),
    requestScroll: jest.fn(),
    setScrollHandler: jest.fn(),
    ...overrides,
  };
}

/**
 * Captures the imperative scroll handler the StackedEditorRenderer registers via
 * `setScrollHandler`. Tests invoke the captured handler to drive the renderer's scroll behavior
 * the same way the wrapper's `requestScroll` does in production.
 */
function captureScrollHandler() {
  let handler: ((item: StackedEditorItem) => void) | null = null;
  const setScrollHandler = jest.fn((next: ((item: StackedEditorItem) => void) | null) => {
    handler = next;
  });
  return { setScrollHandler, invoke: (item: StackedEditorItem) => handler?.(item) };
}

function setupMockIntersectionObserver() {
  const observed = new Map<string | null, Element>();
  let observerCallback: IntersectionObserverCallback | undefined;

  class MockIntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
      observerCallback = callback;
    }
    observe = (element: Element) => {
      observed.set(element.getAttribute('data-stacked-editor-item-id'), element);
    };
    unobserve = jest.fn();
    disconnect = jest.fn();
  }

  const original = global.IntersectionObserver;
  global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

  return {
    observed,
    triggerEntries: (entries: IntersectionObserverEntry[]) => {
      act(() => {
        observerCallback?.(entries, {} as IntersectionObserver);
      });
    },
    waitUntilReady: () => waitFor(() => expect(observerCallback).toBeDefined()),
    restore: () => {
      global.IntersectionObserver = original;
    },
  };
}

describe('QueryEditorContent stacked mode', () => {
  it('renders all queries and transformations as editable stacked items', async () => {
    const updateSelectedQuery = jest.fn();
    const exit = jest.fn();

    const { user, container } = renderWithQueryEditorProvider(<QueryEditorContent />, {
      queries,
      transformations,
      selectedQuery: queries[0],
      dsState: { dsSettings: ds1SettingsMock },
      uiStateOverrides: {
        selectedQueryDsData: { datasource: mockDatasource as DataSourceApi, dsSettings: ds1SettingsMock },
        stackedMode: stackedModeOverrides({ exit }),
      } satisfies Partial<QueryEditorUIState>,
      actionsOverrides: { updateSelectedQuery },
    });

    expect(await screen.findByText('Showing 3 items')).toBeInTheDocument();
    expect(await screen.findByTestId('query-editor-A')).toBeInTheDocument();
    expect(await screen.findByTestId('query-editor-B')).toBeInTheDocument();
    expect(await screen.findAllByAltText('Test logo')).toHaveLength(2);
    expect(screen.getByTestId('transformation-editor-organize-0')).toBeInTheDocument();
    expect(
      Array.from(container.querySelectorAll('[data-stacked-editor-item-id]')).map((element) =>
        element.getAttribute('data-stacked-editor-item-id')
      )
    ).toEqual(['A', 'B', 'organize-0']);
    expect(container.querySelector('[data-stacked-editor-item-id="A"]')).toHaveAttribute('aria-current', 'true');
    expect(container.querySelector('[data-stacked-editor-item-id="B"]')).not.toHaveAttribute('aria-current');

    await user.click(screen.getByRole('button', { name: /change B/i }));
    expect(updateSelectedQuery).toHaveBeenCalledWith(expect.objectContaining({ refId: 'B', hide: true }), 'B');

    await user.click(screen.getByRole('button', { name: /exit stacked view/i }));
    expect(exit).toHaveBeenCalled();
  });

  it('syncs the active stacked item from intersection changes', async () => {
    const syncActiveItem = jest.fn();
    const mockObserver = setupMockIntersectionObserver();

    try {
      renderWithQueryEditorProvider(<QueryEditorContent />, {
        queries,
        transformations,
        selectedQuery: queries[0],
        dsState: { dsSettings: ds1SettingsMock },
        uiStateOverrides: {
          selectedQueryDsData: { datasource: mockDatasource as DataSourceApi, dsSettings: ds1SettingsMock },
          stackedMode: stackedModeOverrides({ syncActiveItem }),
        } satisfies Partial<QueryEditorUIState>,
      });

      await mockObserver.waitUntilReady();
      const queryBElement = mockObserver.observed.get('B');
      expect(queryBElement).toBeDefined();

      mockObserver.triggerEntries([
        {
          target: queryBElement!,
          isIntersecting: true,
          intersectionRatio: 0.8,
          boundingClientRect: { top: 20 } as DOMRectReadOnly,
        } as IntersectionObserverEntry,
      ]);

      expect(syncActiveItem).toHaveBeenCalledWith({ type: QueryEditorType.Query, id: 'B' });

      const transformationElement = mockObserver.observed.get('organize-0');
      expect(transformationElement).toBeDefined();

      mockObserver.triggerEntries([
        {
          target: transformationElement!,
          isIntersecting: true,
          intersectionRatio: 0.9,
          boundingClientRect: { top: 40 } as DOMRectReadOnly,
        } as IntersectionObserverEntry,
      ]);

      expect(syncActiveItem).toHaveBeenCalledWith({
        type: QueryEditorType.Transformation,
        id: 'organize-0',
      });
    } finally {
      mockObserver.restore();
    }
  });

  it('keeps a sidebar-selected item active until its editor becomes visible', async () => {
    const syncActiveItem = jest.fn();
    const scrollHandler = captureScrollHandler();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    // jsdom doesn't implement scrollIntoView — stub it so requesting a scroll doesn't throw.
    HTMLElement.prototype.scrollIntoView = jest.fn();
    const mockObserver = setupMockIntersectionObserver();

    try {
      renderWithQueryEditorProvider(<QueryEditorContent />, {
        queries,
        transformations,
        selectedQuery: queries[1],
        dsState: { dsSettings: ds1SettingsMock },
        uiStateOverrides: {
          selectedQueryDsData: { datasource: mockDatasource as DataSourceApi, dsSettings: ds1SettingsMock },
          stackedMode: stackedModeOverrides({
            syncActiveItem,
            setScrollHandler: scrollHandler.setScrollHandler,
          }),
        } satisfies Partial<QueryEditorUIState>,
      });

      await mockObserver.waitUntilReady();

      // Simulate the wrapper's requestScroll — drives the renderer's pending-scroll-target ref the
      // same way clicking a sidebar card would in production.
      act(() => scrollHandler.invoke({ type: QueryEditorType.Query, id: 'B' }));

      const queryAElement = mockObserver.observed.get('A');
      const queryBElement = mockObserver.observed.get('B');
      expect(queryAElement).toBeDefined();
      expect(queryBElement).toBeDefined();

      // Mid-scroll: A passes through the viewport. Observer must not sync the active item yet.
      mockObserver.triggerEntries([
        {
          target: queryAElement!,
          isIntersecting: true,
          intersectionRatio: 1,
          boundingClientRect: { top: 0 } as DOMRectReadOnly,
        } as IntersectionObserverEntry,
      ]);

      expect(syncActiveItem).not.toHaveBeenCalled();

      // Target reached: A leaves, B fully visible. Observer should sync to B and clear its guard.
      mockObserver.triggerEntries([
        {
          target: queryAElement!,
          isIntersecting: false,
          intersectionRatio: 0,
          boundingClientRect: { top: -20 } as DOMRectReadOnly,
        } as IntersectionObserverEntry,
        {
          target: queryBElement!,
          isIntersecting: true,
          intersectionRatio: 1,
          boundingClientRect: { top: 0 } as DOMRectReadOnly,
        } as IntersectionObserverEntry,
      ]);

      expect(syncActiveItem).toHaveBeenCalledWith({ type: QueryEditorType.Query, id: 'B' });

      // After the guard clears, subsequent intersections for other items must sync normally.
      // Simulate continuing to scroll: B leaves the viewport as organize-0 arrives.
      const transformationElement = mockObserver.observed.get('organize-0');
      mockObserver.triggerEntries([
        {
          target: queryBElement!,
          isIntersecting: false,
          intersectionRatio: 0,
          boundingClientRect: { top: -20 } as DOMRectReadOnly,
        } as IntersectionObserverEntry,
        {
          target: transformationElement!,
          isIntersecting: true,
          intersectionRatio: 1,
          boundingClientRect: { top: 0 } as DOMRectReadOnly,
        } as IntersectionObserverEntry,
      ]);

      expect(syncActiveItem).toHaveBeenCalledWith({
        type: QueryEditorType.Transformation,
        id: 'organize-0',
      });
    } finally {
      mockObserver.restore();
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it('scrolls a requested item into view via the registered scroll handler', async () => {
    const scrollIntoView = jest.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const scrollHandler = captureScrollHandler();

    try {
      renderWithQueryEditorProvider(<QueryEditorContent />, {
        queries,
        transformations,
        selectedQuery: queries[0],
        dsState: { dsSettings: ds1SettingsMock },
        uiStateOverrides: {
          selectedQueryDsData: { datasource: mockDatasource as DataSourceApi, dsSettings: ds1SettingsMock },
          stackedMode: stackedModeOverrides({ setScrollHandler: scrollHandler.setScrollHandler }),
        } satisfies Partial<QueryEditorUIState>,
      });

      // The renderer registered its scroll handler at mount.
      expect(scrollHandler.setScrollHandler).toHaveBeenCalledWith(expect.any(Function));

      // Wait for the editor sections to mount so subsequent async datasource resolution
      // settles before we invoke the imperative scroll handler.
      expect(await screen.findByTestId('query-editor-B')).toBeInTheDocument();

      // Invoking the handler scrolls the matching section into view — same path the wrapper's
      // `requestScroll` takes when a sidebar card is clicked.
      act(() => scrollHandler.invoke({ type: QueryEditorType.Query, id: 'B' }));

      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });
});
