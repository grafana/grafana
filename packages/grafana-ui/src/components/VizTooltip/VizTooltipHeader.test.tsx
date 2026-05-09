import { render, screen } from '@testing-library/react';

import { VizTooltipHeader } from './VizTooltipHeader';
import { ColorIndicator, type VizTooltipItem } from './types';

const makeItem = (overrides: Partial<VizTooltipItem> = {}): VizTooltipItem => ({
  label: 'Series A',
  value: '42',
  ...overrides,
});

describe('VizTooltipHeader', () => {
  it('renders the item label', () => {
    render(<VizTooltipHeader item={makeItem()} isPinned={false} />);
    expect(screen.getByText('Series A')).toBeInTheDocument();
  });

  it('renders the item value', () => {
    render(<VizTooltipHeader item={makeItem()} isPinned={false} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders a color indicator when color is provided', () => {
    render(
      <VizTooltipHeader item={makeItem({ color: '#ff0000', colorIndicator: ColorIndicator.series })} isPinned={false} />
    );
    expect(screen.getByTestId('series-icon')).toBeInTheDocument();
  });

  it('does not render a color indicator when color is absent', () => {
    render(<VizTooltipHeader item={makeItem({ color: undefined })} isPinned={false} />);
    expect(screen.queryByTestId('series-icon')).not.toBeInTheDocument();
  });

  it('renders label and value when pinned', () => {
    render(<VizTooltipHeader item={makeItem()} isPinned={true} />);
    expect(screen.getByText('Series A')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});
