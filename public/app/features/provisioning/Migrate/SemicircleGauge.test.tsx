import { render } from 'test/test-utils';

import { SemicircleGauge } from './SemicircleGauge';

// Mirrors the component: half-circle arc length = π * radius (radius 40).
const ARC_LENGTH = Math.PI * 40;

// The gauge is a decorative (aria-hidden) SVG with no accessible text, so the
// only way to assert its visual state is to read the fill path geometry. The
// fill is the second <path> (the first is the track); its stroke-dasharray is
// `${filled} ${total}`.
function getFilledLength(container: HTMLElement): number {
  const fillPath = container.querySelectorAll('path')[1];
  const dashArray = fillPath?.getAttribute('stroke-dasharray') ?? '';
  return parseFloat(dashArray.split(' ')[0]);
}

describe('SemicircleGauge', () => {
  it('renders a decorative, aria-hidden svg', () => {
    const { container } = render(<SemicircleGauge pct={0.5} />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('scales the fill to the percentage', () => {
    const { container } = render(<SemicircleGauge pct={0.5} />);

    expect(getFilledLength(container)).toBeCloseTo(ARC_LENGTH * 0.5, 1);
  });

  it('clamps percentages above 1 to a full arc', () => {
    const { container } = render(<SemicircleGauge pct={1.5} />);

    expect(getFilledLength(container)).toBeCloseTo(ARC_LENGTH, 1);
  });

  it('clamps negative percentages to an empty arc', () => {
    const { container } = render(<SemicircleGauge pct={-0.5} />);

    expect(getFilledLength(container)).toBe(0);
  });
});
