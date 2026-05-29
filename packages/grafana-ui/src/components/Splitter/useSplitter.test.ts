import { renderHook } from '@testing-library/react';

import { useSplitter } from './useSplitter';

describe('useSplitter', () => {
  describe('flex sizing (default)', () => {
    it('splits both panes by flexGrow and pins neither to pixels', () => {
      const { result } = renderHook(() => useSplitter({ direction: 'row', initialSize: 0.5 }));
      const { style: primary } = result.current.primaryProps;
      const { style: secondary } = result.current.secondaryProps;

      expect(primary.flexGrow).toBe(0.5);
      expect(secondary.flexGrow).toBe(0.5);
      expect(primary.flexBasis).toBeUndefined();
      expect(secondary.flexBasis).toBeUndefined();
    });

    it('ignores pixelPane when usePixels is not set', () => {
      const { result } = renderHook(() => useSplitter({ direction: 'row', pixelPane: 'primary', initialSize: 0.5 }));
      const { style: primary } = result.current.primaryProps;

      expect(primary.flexGrow).toBe(0.5);
      expect(primary.flexBasis).toBeUndefined();
    });
  });

  describe('pixel sizing', () => {
    it('pins the secondary pane by default', () => {
      const { result } = renderHook(() => useSplitter({ direction: 'row', usePixels: true, initialSize: 330 }));
      const { style: primary } = result.current.primaryProps;
      const { style: secondary } = result.current.secondaryProps;

      expect(secondary.flexBasis).toBe('330px');
      expect(secondary.flexGrow).toBe('unset');
      expect(primary.flexGrow).toBe(1);
      expect(primary.flexBasis).toBeUndefined();
    });

    it('pins the primary pane when pixelPane is "primary"', () => {
      const { result } = renderHook(() =>
        useSplitter({ direction: 'row', usePixels: true, pixelPane: 'primary', initialSize: 330 })
      );
      const { style: primary } = result.current.primaryProps;
      const { style: secondary } = result.current.secondaryProps;

      expect(primary.flexBasis).toBe('330px');
      expect(primary.flexGrow).toBe('unset');
      expect(secondary.flexGrow).toBe(1);
      expect(secondary.flexBasis).toBeUndefined();
    });
  });
});
