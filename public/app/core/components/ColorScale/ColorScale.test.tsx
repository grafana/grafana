import { render, screen } from '@testing-library/react';

import { ColorScale } from './ColorScale';

// Controls the measured container size so tick-count decisions are
// deterministic (real measurement needs layout that jsdom doesn't do).
let mockMeasuredWidth = 0;
let mockMeasuredHeight = 0;

jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useMeasure: () => [jest.fn(), { width: mockMeasuredWidth, height: mockMeasuredHeight }],
}));

const palette = ['#0000ff', '#ff0000'];

const getTickLabels = () => Array.from(document.querySelectorAll('span')).map((tickEl) => tickEl.textContent);

describe('ColorScale', () => {
  describe('tick generation', () => {
    it('renders no tick labels when display is not provided', () => {
      mockMeasuredWidth = 320;
      render(<ColorScale colorPalette={palette} min={0} max={100} />);

      expect(document.querySelectorAll('span')).toHaveLength(0);
    });

    it('renders only min and max before the container is measured (width 0)', () => {
      mockMeasuredWidth = 0;
      render(<ColorScale colorPalette={palette} min={0} max={100} display={(v) => `${v}`} />);

      expect(getTickLabels()).toEqual(['0', '100']);
    });

    it('renders only min and max when the container is too narrow for more', () => {
      mockMeasuredWidth = 100;
      render(<ColorScale colorPalette={palette} min={0} max={100} display={(v) => `${v}`} />);

      expect(getTickLabels()).toEqual(['0', '100']);
    });

    it('adds intermediate ticks at uniform spacing when there is room', () => {
      mockMeasuredWidth = 320;
      render(<ColorScale colorPalette={palette} min={0} max={100} display={(v) => `${v}`} />);

      expect(getTickLabels()).toEqual(['0', '25', '50', '75', '100']);
    });

    it('positions ticks by their value along the scale', () => {
      mockMeasuredWidth = 320;
      render(<ColorScale colorPalette={palette} min={0} max={100} display={(v) => `${v}`} />);

      expect(screen.getByText('0').style.left).toBe('0%');
      expect(screen.getByText('25').style.left).toBe('25%');
      expect(screen.getByText('50').style.left).toBe('50%');
      expect(screen.getByText('100').style.left).toBe('100%');
    });

    it('anchors the first tick left, the last tick right, and centers intermediates', () => {
      mockMeasuredWidth = 320;
      render(<ColorScale colorPalette={palette} min={0} max={100} display={(v) => `${v}`} />);

      expect(screen.getByText('0').style.transform).toBe('');
      expect(screen.getByText('50').style.transform).toBe('translateX(-50%)');
      expect(screen.getByText('100').style.transform).toBe('translateX(-100%)');
    });
  });

  describe('integer ticks', () => {
    it('snaps intermediate ticks to whole values when min and max are integers', () => {
      // 1..58 in 4 steps of 14.25 would give 15.25, 29.5, 43.75 -- these
      // must snap to whole values
      mockMeasuredWidth = 280;
      render(<ColorScale colorPalette={palette} min={1} max={58} display={(v) => `${v}`} />);

      expect(getTickLabels()).toEqual(['1', '15', '30', '44', '58']);
    });

    it('positions snapped ticks where the snapped value falls on the scale', () => {
      mockMeasuredWidth = 280;
      render(<ColorScale colorPalette={palette} min={1} max={58} display={(v) => `${v}`} />);

      // (15 - 1) / 57 ~= 24.56%, not the uniform 25%
      const left = parseFloat(screen.getByText('15').style.left);
      expect(left).toBeCloseTo((14 / 57) * 100, 5);
    });

    it('drops ticks that would collapse into duplicate labels after snapping', () => {
      // 0..2 has room for 7 ticks at this width, but only 3 distinct integers
      mockMeasuredWidth = 320;
      render(<ColorScale colorPalette={palette} min={0} max={2} display={(v) => `${v}`} />);

      expect(getTickLabels()).toEqual(['0', '1', '2']);
    });
  });

  describe('float ticks', () => {
    it('renders interpolated fractional ticks when min and max are not integers', () => {
      mockMeasuredWidth = 320;
      render(<ColorScale colorPalette={palette} min={0.1} max={0.9} display={(v) => v.toFixed(1)} />);

      expect(getTickLabels()).toEqual(['0.1', '0.3', '0.5', '0.7', '0.9']);
    });

    it('positions fractional ticks at uniform spacing', () => {
      mockMeasuredWidth = 320;
      render(<ColorScale colorPalette={palette} min={0.1} max={0.9} display={(v) => v.toFixed(1)} />);

      // float interpolation can be off by ulps, so compare numerically
      expect(parseFloat(screen.getByText('0.5').style.left)).toBeCloseTo(50, 6);
      expect(parseFloat(screen.getByText('0.7').style.left)).toBeCloseTo(75, 6);
    });

    it('drops ticks that would collapse into duplicate labels under coarse formatting', () => {
      // toFixed(0) renders every tick in 0.1..0.9 as "0" or "1", so the
      // count must back off all the way to just min and max
      mockMeasuredWidth = 320;
      render(<ColorScale colorPalette={palette} min={0.1} max={0.9} display={(v) => v.toFixed(0)} />);

      expect(getTickLabels()).toEqual(['0', '1']);
    });
  });

  describe('tick count vs width for a fixed range', () => {
    // 0..100 labels are at most 3 chars, so each tick needs a
    // 3 * APPROX_CHAR_WIDTH + LABEL_GAP = 60px slot
    it.each([
      [300, ['0', '25', '50', '75', '100']],
      [299, ['0', '33', '67', '100']],
      [240, ['0', '33', '67', '100']],
      [239, ['0', '50', '100']],
      [180, ['0', '50', '100']],
      [179, ['0', '100']],
      [120, ['0', '100']],
      [60, ['0', '100']],
    ])('renders the expected ticks at %ipx', (width, expected) => {
      mockMeasuredWidth = width;
      render(<ColorScale colorPalette={palette} min={0} max={100} display={(v) => `${v}`} />);

      expect(getTickLabels()).toEqual(expected);
    });
  });

  describe('vertical orientation', () => {
    const renderVertical = (props: Partial<Parameters<typeof ColorScale>[0]> = {}) =>
      render(
        <ColorScale
          colorPalette={palette}
          min={0}
          max={100}
          display={(v) => `${v}`}
          orientation="vertical"
          {...props}
        />
      );

    it('sizes tick count by measured height, not width', () => {
      mockMeasuredWidth = 320;
      // each vertical label needs a 15 + 20 = 35px slot
      mockMeasuredHeight = 175;
      renderVertical();

      expect(getTickLabels()).toEqual(['0', '25', '50', '75', '100']);
    });

    it('renders only min and max when the container is too short for more', () => {
      mockMeasuredWidth = 320;
      mockMeasuredHeight = 100;
      renderVertical();

      expect(getTickLabels()).toEqual(['0', '100']);
    });

    it('renders three ticks once there is room for three slots', () => {
      mockMeasuredWidth = 320;
      mockMeasuredHeight = 105;
      renderVertical();

      expect(getTickLabels()).toEqual(['0', '50', '100']);
    });

    it('positions ticks from the bottom of the scale', () => {
      mockMeasuredWidth = 320;
      mockMeasuredHeight = 175;
      renderVertical();

      expect(screen.getByText('0').style.bottom).toBe('0%');
      expect(screen.getByText('25').style.bottom).toBe('25%');
      expect(screen.getByText('100').style.bottom).toBe('100%');
    });

    it('anchors the min tick at the bottom, the max tick at the top, and centers intermediates', () => {
      mockMeasuredWidth = 320;
      mockMeasuredHeight = 175;
      renderVertical();

      expect(screen.getByText('0').style.transform).toBe('');
      expect(screen.getByText('50').style.transform).toBe('translateY(50%)');
      expect(screen.getByText('100').style.transform).toBe('translateY(100%)');
    });

    it('drops ticks that would collapse into duplicate labels after snapping', () => {
      mockMeasuredHeight = 175;
      renderVertical({ min: 0, max: 2 });

      expect(getTickLabels()).toEqual(['0', '1', '2']);
    });

    it('gives the values column an explicit width derived from the widest label', () => {
      mockMeasuredWidth = 320;
      mockMeasuredHeight = 175;
      renderVertical();

      // "100" is the widest label: 3 chars * 8px
      const valuesEl = screen.getByText('100').parentElement!;
      expect(valuesEl.style.width).toBe('24px');
    });
  });

  describe('range changes', () => {
    it('regenerates ticks when min/max change', () => {
      mockMeasuredWidth = 320;
      const display = (v: number) => `${v}`;

      const { rerender } = render(<ColorScale colorPalette={palette} min={0} max={100} display={display} />);
      expect(getTickLabels()).toEqual(['0', '25', '50', '75', '100']);

      rerender(<ColorScale colorPalette={palette} min={0} max={400} display={display} />);
      expect(getTickLabels()).toEqual(['0', '100', '200', '300', '400']);
    });

    it('renders only min and max when the range is empty', () => {
      mockMeasuredWidth = 320;
      render(<ColorScale colorPalette={palette} min={5} max={5} display={(v) => `${v}`} />);

      expect(getTickLabels()).toEqual(['5', '5']);
      expect(screen.getAllByText('5')[0].style.left).toBe('0%');
      expect(screen.getAllByText('5')[1].style.left).toBe('100%');
    });
  });
});
