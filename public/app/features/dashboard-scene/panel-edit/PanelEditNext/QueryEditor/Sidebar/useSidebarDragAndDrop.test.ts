import { DropResult } from '@hello-pangea/dnd';
import { renderHook } from '@testing-library/react';

import { DataQuery } from '@grafana/schema';

import { Transformation } from '../types';

import { useSidebarDragAndDrop } from './useSidebarDragAndDrop';

const mockUpdateQueries = jest.fn();
const mockReorderTransformations = jest.fn();
const mockReportInteraction = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: (...args: unknown[]) => mockReportInteraction(...args),
}));

jest.mock('../QueryEditorContext', () => ({
  useDatasourceContext: () => ({
    dsSettings: { type: 'prometheus' },
  }),
  useActionsContext: () => ({
    updateQueries: mockUpdateQueries,
    reorderTransformations: mockReorderTransformations,
  }),
}));

const queries: DataQuery[] = [
  { refId: 'A', datasource: { type: 'prometheus', uid: 'prom1' } },
  { refId: 'B', datasource: { type: 'prometheus', uid: 'prom1' } },
  { refId: 'C', datasource: { type: 'prometheus', uid: 'prom1' } },
];

const transformations: Transformation[] = [
  { transformId: 't1', registryItem: undefined, transformConfig: { id: 'organize', options: {} } },
  { transformId: 't2', registryItem: undefined, transformConfig: { id: 'reduce', options: {} } },
  { transformId: 't3', registryItem: undefined, transformConfig: { id: 'filter', options: {} } },
];

function makeDropResult(sourceIndex: number, destinationIndex: number | null): DropResult {
  return {
    draggableId: 'test',
    type: 'DEFAULT',
    reason: 'DROP',
    mode: 'FLUID',
    source: { droppableId: 'droppable', index: sourceIndex },
    destination: destinationIndex !== null ? { droppableId: 'droppable', index: destinationIndex } : null,
    combine: null,
  };
}

describe('useSidebarDragAndDrop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('onQueryDragStart', () => {
    it('should report query_row_reorder_started interaction', () => {
      const { result } = renderHook(() => useSidebarDragAndDrop({ queries, transformations }));

      result.current.onQueryDragStart();

      expect(mockReportInteraction).toHaveBeenCalledWith('query_row_reorder_started', {
        numberOfQueries: 3,
        datasourceType: 'prometheus',
      });
    });
  });

  describe('onQueryDragEnd', () => {
    it('should reorder queries and report interaction on successful drag', () => {
      const { result } = renderHook(() => useSidebarDragAndDrop({ queries, transformations }));

      result.current.onQueryDragEnd(makeDropResult(0, 2));

      expect(mockUpdateQueries).toHaveBeenCalledWith([queries[1], queries[2], queries[0]]);
      expect(mockReportInteraction).toHaveBeenCalledWith('query_row_reorder_ended', {
        startIndex: 0,
        endIndex: 2,
        numberOfQueries: 3,
        datasourceType: 'prometheus',
      });
    });

    it('should not reorder when dropped outside droppable area', () => {
      const { result } = renderHook(() => useSidebarDragAndDrop({ queries, transformations }));

      result.current.onQueryDragEnd(makeDropResult(0, null));

      expect(mockUpdateQueries).not.toHaveBeenCalled();
      expect(mockReportInteraction).not.toHaveBeenCalled();
    });

    it('should report canceled interaction when dropped at same index', () => {
      const { result } = renderHook(() => useSidebarDragAndDrop({ queries, transformations }));

      result.current.onQueryDragEnd(makeDropResult(1, 1));

      expect(mockUpdateQueries).not.toHaveBeenCalled();
      expect(mockReportInteraction).toHaveBeenCalledWith('query_row_reorder_canceled', {
        startIndex: 1,
        endIndex: 1,
        numberOfQueries: 3,
        datasourceType: 'prometheus',
      });
    });
  });

  describe('onTransformationDragEnd', () => {
    it('should reorder transformations on successful drag', () => {
      const { result } = renderHook(() => useSidebarDragAndDrop({ queries, transformations }));

      result.current.onTransformationDragEnd(makeDropResult(0, 2));

      expect(mockReorderTransformations).toHaveBeenCalledWith([
        transformations[1].transformConfig,
        transformations[2].transformConfig,
        transformations[0].transformConfig,
      ]);
    });

    it('should not reorder when dropped outside droppable area', () => {
      const { result } = renderHook(() => useSidebarDragAndDrop({ queries, transformations }));

      result.current.onTransformationDragEnd(makeDropResult(0, null));

      expect(mockReorderTransformations).not.toHaveBeenCalled();
    });

    it('should not reorder when dropped at same index', () => {
      const { result } = renderHook(() => useSidebarDragAndDrop({ queries, transformations }));

      result.current.onTransformationDragEnd(makeDropResult(1, 1));

      expect(mockReorderTransformations).not.toHaveBeenCalled();
    });

    it('should not report analytics on transformation reorder', () => {
      const { result } = renderHook(() => useSidebarDragAndDrop({ queries, transformations }));

      result.current.onTransformationDragEnd(makeDropResult(0, 1));

      expect(mockReportInteraction).not.toHaveBeenCalled();
    });
  });
});
