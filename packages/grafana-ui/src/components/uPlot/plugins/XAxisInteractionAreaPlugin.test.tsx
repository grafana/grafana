import uPlot from 'uplot';

import { UPlotConfigBuilder } from '../config/UPlotConfigBuilder';

import { setupXAxisPan } from './XAxisInteractionAreaPlugin';

const asUPlot = (partial: Partial<uPlot>) => partial as uPlot;
const asConfigBuilder = (partial: Partial<UPlotConfigBuilder>) => partial as UPlotConfigBuilder;

const createMockXAxis = () => {
  const element = document.createElement('div');
  element.classList.add('u-axis');
  return element;
};

const createMockConfigBuilder = () => {
  return {
    setState: jest.fn(),
    getState: jest.fn(() => ({ isPanning: false, min: 0, max: 0 })),
  } satisfies Partial<UPlotConfigBuilder>;
};

const createMockUPlot = (xAxisElement: HTMLElement) => {
  const root = document.createElement('div');
  root.appendChild(xAxisElement);

  const over = document.createElement('div');
  Object.defineProperty(over, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 800, height: 400 }),
  });

  return {
    root,
    over,
    bbox: { width: 800, height: 400, left: 0, top: 0 },
    scales: {
      x: {
        min: 1000,
        max: 2000,
        range: () => [1000, 2000],
      },
    },
    setScale: jest.fn(),
  } satisfies Partial<uPlot>;
};

describe('XAxisInteractionAreaPlugin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setupXAxisPan', () => {
    let mockQueryZoom: jest.Mock;
    let mockConfigBuilder: ReturnType<typeof createMockConfigBuilder>;
    let xAxisElement: HTMLElement;
    let mockUPlot: ReturnType<typeof createMockUPlot>;

    beforeEach(() => {
      mockQueryZoom = jest.fn();
      mockConfigBuilder = createMockConfigBuilder();
      xAxisElement = createMockXAxis();
      mockUPlot = createMockUPlot(xAxisElement);
      document.body.appendChild(mockUPlot.root!);
    });

    afterEach(() => {
      document.body.innerHTML = '';
      jest.clearAllMocks();
    });

    describe('Initialization', () => {
      it('should set up x-axis panning when called', () => {
        setupXAxisPan(asUPlot(mockUPlot), asConfigBuilder(mockConfigBuilder), mockQueryZoom);

        xAxisElement.dispatchEvent(new MouseEvent('mouseenter'));
        expect(xAxisElement).toHaveStyle({ cursor: 'grab' });
      });

      it('should handle missing x-axis element gracefully', () => {
        const emptyRoot = document.createElement('div');
        const emptyUPlot = { ...mockUPlot, root: emptyRoot };

        expect(() =>
          setupXAxisPan(asUPlot(emptyUPlot), asConfigBuilder(mockConfigBuilder), mockQueryZoom)
        ).not.toThrow();
      });
    });

    describe('Cursor States', () => {
      it('should transition through hover, drag, and leave states', () => {
        setupXAxisPan(asUPlot(mockUPlot), asConfigBuilder(mockConfigBuilder), mockQueryZoom);

        xAxisElement.dispatchEvent(new MouseEvent('mouseenter'));
        expect(xAxisElement).toHaveStyle({ cursor: 'grab' });

        xAxisElement.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, bubbles: true }));
        expect(xAxisElement).toHaveStyle({ cursor: 'grabbing' });

        document.dispatchEvent(new MouseEvent('mouseup', { clientX: 350, bubbles: true }));
        expect(xAxisElement).toHaveStyle({ cursor: 'grab' });

        xAxisElement.dispatchEvent(new MouseEvent('mouseleave'));
        expect(xAxisElement).toHaveStyle({ cursor: '' });
      });
    });

    describe('Drag Interaction', () => {
      it('should update scale in real-time and call queryZoom on completion', () => {
        setupXAxisPan(asUPlot(mockUPlot), asConfigBuilder(mockConfigBuilder), mockQueryZoom);

        xAxisElement.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, bubbles: true }));
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 350, bubbles: true }));

        expect(mockUPlot.setScale).toHaveBeenCalledWith(
          'x',
          expect.objectContaining({
            min: expect.any(Number),
            max: expect.any(Number),
          })
        );

        document.dispatchEvent(new MouseEvent('mouseup', { clientX: 350, bubbles: true }));

        expect(mockQueryZoom).toHaveBeenCalledWith(
          expect.objectContaining({
            from: expect.any(Number),
            to: expect.any(Number),
          })
        );
      });

      it('should not call queryZoom when drag distance is below MIN_ZOOM_DIST threshold', () => {
        setupXAxisPan(asUPlot(mockUPlot), asConfigBuilder(mockConfigBuilder), mockQueryZoom);

        xAxisElement.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, bubbles: true }));
        document.dispatchEvent(new MouseEvent('mouseup', { clientX: 402, bubbles: true }));

        expect(mockQueryZoom).not.toHaveBeenCalled();
      });
    });

    describe('State Management', () => {
      it('should call setState during drag and restore on mouseup', () => {
        setupXAxisPan(asUPlot(mockUPlot), asConfigBuilder(mockConfigBuilder), mockQueryZoom);

        xAxisElement.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, bubbles: true }));
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 350, bubbles: true }));

        expect(mockConfigBuilder.setState).toHaveBeenCalledWith({
          isPanning: true,
          min: expect.any(Number),
          max: expect.any(Number),
        });

        document.dispatchEvent(new MouseEvent('mouseup', { clientX: 350, bubbles: true }));

        expect(mockConfigBuilder.setState).toHaveBeenCalledWith({ isPanning: false });
      });
    });
  });
});
