import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type GeomapLayerHover } from 'app/plugins/panel/geomap/event';
import { type MapLayerState } from 'app/plugins/panel/geomap/types';

import { ComplexDataHoverView } from './ComplexDataHoverView';

jest.mock('./DataHoverRows', () => ({
  DataHoverRows: ({ activeTabIndex }: { activeTabIndex: number }) => (
    <div data-testid="data-hover-rows" data-active-tab={activeTabIndex} />
  ),
}));

jest.mock('./DataHoverTabs', () => ({
  DataHoverTabs: ({
    layers,
    activeTabIndex,
    setActiveTabIndex,
  }: {
    layers: GeomapLayerHover[];
    activeTabIndex: number;
    setActiveTabIndex: (i: number) => void;
  }) => (
    <div data-testid="data-hover-tabs">
      {layers.map((l, i) => (
        <button key={i} onClick={() => setActiveTabIndex(i)} aria-selected={i === activeTabIndex}>
          {l.layer.getName()}
        </button>
      ))}
    </div>
  ),
}));

function makeLayer(name: string): GeomapLayerHover {
  return {
    layer: { getName: () => name } as MapLayerState,
    features: [],
  };
}

describe('ComplexDataHoverView', () => {
  it('returns null when layers is undefined', () => {
    const { container } = render(<ComplexDataHoverView layers={undefined} isOpen={false} onClose={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders tabs and rows when layers are provided', () => {
    const layers = [makeLayer('Layer A')];
    render(<ComplexDataHoverView layers={layers} isOpen={false} onClose={jest.fn()} />);
    expect(screen.getByTestId('data-hover-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('data-hover-rows')).toBeInTheDocument();
  });

  it('shows a close button when isOpen is true', () => {
    const layers = [makeLayer('Layer A')];
    render(<ComplexDataHoverView layers={layers} isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('does not show a close button when isOpen is false', () => {
    const layers = [makeLayer('Layer A')];
    render(<ComplexDataHoverView layers={layers} isOpen={false} onClose={jest.fn()} />);
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = jest.fn();
    const layers = [makeLayer('Layer A')];
    render(<ComplexDataHoverView layers={layers} isOpen={true} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('defaults to showing the first tab (activeTabIndex 0)', () => {
    const layers = [makeLayer('Layer A'), makeLayer('Layer B')];
    render(<ComplexDataHoverView layers={layers} isOpen={false} onClose={jest.fn()} />);
    expect(screen.getByTestId('data-hover-rows')).toHaveAttribute('data-active-tab', '0');
  });

  it('updates activeTabIndex when a tab is clicked', async () => {
    const layers = [makeLayer('Layer A'), makeLayer('Layer B')];
    render(<ComplexDataHoverView layers={layers} isOpen={false} onClose={jest.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Layer B' }));
    expect(screen.getByTestId('data-hover-rows')).toHaveAttribute('data-active-tab', '1');
  });
});
