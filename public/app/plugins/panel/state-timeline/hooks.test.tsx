import { render, renderHook, screen } from '@testing-library/react';

import { createDataFrame, FieldType } from '@grafana/data';

import { usePagination } from './hooks';

describe('StateTimelinePanel hooks', () => {
  describe('usePagination', () => {
    describe('empty value', () => {
      it('returns the empty value if perPage is not set', () => {
        const { result } = renderHook(() => usePagination([]));
        expect(result.current).toEqual({
          paginatedFrames: [],
          paginationRev: 'disabled',
          paginationElement: undefined,
          paginationHeight: 0,
        });
      });

      it('returns the empty value if frames are not set', () => {
        const { result } = renderHook(() => usePagination(undefined, 5));
        expect(result.current).toEqual({
          paginatedFrames: undefined,
          paginationRev: 'disabled',
          paginationElement: undefined,
          paginationHeight: 0,
        });
      });
    });

    it('returns the React element to be rendered for pagination', () => {
      const frames = createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [100, 200, 300] },
          { name: 'value-A', type: FieldType.number, values: [4, 5, 6] },
          { name: 'value-B', type: FieldType.number, values: [4, 5, 6] },
          { name: 'value-C', type: FieldType.number, values: [4, 5, 6] },
        ],
      });

      const { result } = renderHook(() => usePagination([frames], 2));

      expect(result.current.paginatedFrames?.length).toBe(2);
    });

    const frame = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] },
        { name: 'value-A', type: FieldType.number, values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
        { name: 'value-B', type: FieldType.number, values: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
        { name: 'value-C', type: FieldType.number, values: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30] },
      ],
    });
    const { result } = renderHook(() => usePagination([frame], 2));

    render(result.current.paginationElement);

    expect(screen.getByText('1')).toBeInTheDocument(); // current page
    expect(screen.getByText('2')).toBeInTheDocument(); // last page
    expect(screen.getByLabelText('next page')).not.toBeDisabled();
  });
});
