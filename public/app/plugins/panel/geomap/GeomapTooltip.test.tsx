import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GeomapTooltip } from './GeomapTooltip';
import { type GeomapHoverPayload } from './event';

jest.mock('app/features/visualization/data-hover/ComplexDataHoverView', () => ({
  ComplexDataHoverView: ({ layers, isOpen }: { layers?: unknown[]; isOpen: boolean }) => (
    <div data-testid="complex-hover">
      {layers?.length ?? 0} layers (isOpen={String(isOpen)})
    </div>
  ),
}));

const layerPayload: GeomapHoverPayload = {
  point: { lat: 10, lon: 20 },
  pageX: 100,
  pageY: 200,
  layers: [
    {
      // GeomapLayerHover has `layer: MapLayerState` and `features: FeatureLike[]`.
      // Our mock only reads `layers.length` so an empty stub is sufficient.
      layer: {} as never,
      features: [],
    },
  ],
};

describe('GeomapTooltip', () => {
  it('should render nothing when ttip is undefined', () => {
    render(<GeomapTooltip ttip={undefined} isOpen={false} onClose={jest.fn()} />);
    expect(screen.queryByTestId('complex-hover')).not.toBeInTheDocument();
  });

  it('should render nothing when ttip has no layers field', () => {
    const noLayers: GeomapHoverPayload = { point: {}, pageX: 0, pageY: 0 };
    render(<GeomapTooltip ttip={noLayers} isOpen={false} onClose={jest.fn()} />);
    expect(screen.queryByTestId('complex-hover')).not.toBeInTheDocument();
  });

  it('should render hover content in a portal when ttip.layers is set', () => {
    const { container } = render(<GeomapTooltip ttip={layerPayload} isOpen={true} onClose={jest.fn()} />);
    const hover = screen.getByTestId('complex-hover');
    expect(hover).toBeInTheDocument();
    expect(hover).toHaveTextContent('1 layers (isOpen=true)');
    // Portal content lives outside the test render root.
    expect(container.contains(hover)).toBe(false);
  });

  it('should call onClose when a dismissable outside click occurs', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<GeomapTooltip ttip={layerPayload} isOpen={true} onClose={onClose} />);

    // Confirm the tooltip is mounted, then click an element outside its overlay section.
    expect(screen.getByTestId('complex-hover')).toBeInTheDocument();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    await user.click(outside);
    document.body.removeChild(outside);

    expect(onClose).toHaveBeenCalled();
  });
});
