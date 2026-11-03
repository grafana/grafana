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

      it('renders no pagination when there are no frames to paginate', () => {
        const { result } = renderHook(() => usePagination([], 5));

        expect(result.current.paginatedFrames).toEqual([]);
        expect(result.current.paginationRev).toBe('0/5');

        render(result.current.paginationElement);

        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
        expect(screen.queryByText('0')).not.toBeInTheDocument();
      });

      it('renders no pagination when the frames hold no series', () => {
        const timeOnly = createDataFrame({
          fields: [{ name: 'time', type: FieldType.time, values: [100, 200, 300] }],
        });

        const { result } = renderHook(() => usePagination([timeOnly], 5));

        expect(result.current.paginatedFrames).toEqual([]);

        render(result.current.paginationElement);

        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
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

    describe('single page', () => {
      const buildFrame = (numberOfSeries: number) =>
        createDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [100, 200, 300] },
            ...Array.from({ length: numberOfSeries }, (_, index) => ({
              name: `value-${index}`,
              type: FieldType.number,
              values: [4, 5, 6],
            })),
          ],
        });

      it('renders nothing while every series fits on one page', () => {
        const { result } = renderHook(() => usePagination([buildFrame(3)], 3));

        expect(result.current.paginatedFrames).toHaveLength(3);

        render(result.current.paginationElement);

        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('next page')).not.toBeInTheDocument();
      });

      it('renders as soon as one series does not fit', () => {
        const { result } = renderHook(() => usePagination([buildFrame(4)], 3));

        expect(result.current.paginatedFrames).toHaveLength(3); // 4 series, page 1 of 2

        render(result.current.paginationElement);

        expect(screen.getByRole('navigation')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument(); // last page
        expect(screen.getByLabelText('next page')).not.toBeDisabled();
      });
    });

    it('renders the pagination control when there is more than one page', () => {
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
});
