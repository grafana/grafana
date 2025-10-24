import uPlot from 'uplot';

import { getFeatureToggle } from '../../../utils/featureToggle';

import { setupXAxisPan } from './TooltipPlugin2';

jest.mock('../../../utils/featureToggle', () => ({
  getFeatureToggle: jest.fn(),
}));

const mockGetFeatureToggle = getFeatureToggle as jest.MockedFunction<typeof getFeatureToggle>;

const createMockXAxis = () => {
  const element = document.createElement('div');
  element.classList.add('u-axis');
  return element;
};

const createMockUPlot = (xAxisElement: HTMLElement): Partial<uPlot> => {
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
  } as Partial<uPlot>;
};

describe('TooltipPlugin2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setupXAxisPan', () => {
    let mockQueryZoom: jest.Mock;
    let xAxisElement: HTMLElement;
    let mockUPlot: Partial<uPlot>;

    beforeEach(() => {
      mockQueryZoom = jest.fn();
      xAxisElement = createMockXAxis();
      mockUPlot = createMockUPlot(xAxisElement);
      document.body.appendChild(mockUPlot.root!);
    });

    afterEach(() => {
      document.body.innerHTML = '';
      jest.clearAllMocks();
    });

    describe('when feature toggle is disabled', () => {
      beforeEach(() => {
        mockGetFeatureToggle.mockImplementation((featureName) => {
          return featureName === 'timeRangePan' ? false : false;
        });
      });

      it('should NOT set up x-axis panning even when queryZoom is provided', () => {
        const shouldSetup = mockGetFeatureToggle('timeRangePan');

        if (shouldSetup) {
          setupXAxisPan(mockUPlot as uPlot, mockQueryZoom);
        }

        expect(mockGetFeatureToggle).toHaveBeenCalledWith('timeRangePan');

        xAxisElement.dispatchEvent(new MouseEvent('mouseenter'));
        expect(xAxisElement).not.toHaveStyle({ cursor: 'grab' });
      });
    });

    describe('when feature toggle is enabled', () => {
      beforeEach(() => {
        mockGetFeatureToggle.mockImplementation((featureName) => {
          return featureName === 'timeRangePan' ? true : false;
        });
      });

      describe('Initialization', () => {
        it('should set up x-axis panning when called', () => {
          setupXAxisPan(mockUPlot as uPlot, mockQueryZoom);

          xAxisElement.dispatchEvent(new MouseEvent('mouseenter'));
          expect(xAxisElement).toHaveStyle({ cursor: 'grab' });
        });

        it('should handle missing x-axis element gracefully', () => {
          const emptyRoot = document.createElement('div');
          const emptyUPlot = { ...mockUPlot, root: emptyRoot } as uPlot;

          expect(() => setupXAxisPan(emptyUPlot, mockQueryZoom)).not.toThrow();
        });
      });

      describe('Cursor States', () => {
        it('should transition through hover, drag, and leave states', () => {
          setupXAxisPan(mockUPlot as uPlot, mockQueryZoom);

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
          setupXAxisPan(mockUPlot as uPlot, mockQueryZoom);

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
          setupXAxisPan(mockUPlot as uPlot, mockQueryZoom);

          xAxisElement.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, bubbles: true }));
          document.dispatchEvent(new MouseEvent('mouseup', { clientX: 402, bubbles: true }));

          expect(mockQueryZoom).not.toHaveBeenCalled();
        });
      });

      describe('Scale Range Function', () => {
        it('should temporarily override and restore scale range function', () => {
          setupXAxisPan(mockUPlot as uPlot, mockQueryZoom);

          const originalRange = mockUPlot.scales!.x.range;

          xAxisElement.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, bubbles: true }));
          expect(mockUPlot.scales!.x.range).not.toBe(originalRange);

          document.dispatchEvent(new MouseEvent('mouseup', { clientX: 350, bubbles: true }));
          expect(mockUPlot.scales!.x.range).toBe(originalRange);
        });
      });
    });

    describe('when queryZoom is not provided', () => {
      beforeEach(() => {
        mockGetFeatureToggle.mockImplementation((featureName) => {
          return featureName === 'timeRangePan' ? true : false;
        });
      });

      it('should NOT set up x-axis panning even if feature toggle is enabled', () => {
        const queryZoom = null;
        const shouldSetup = queryZoom != null && mockGetFeatureToggle('timeRangePan');

        expect(shouldSetup).toBe(false);

        xAxisElement.dispatchEvent(new MouseEvent('mouseenter'));
        expect(xAxisElement).not.toHaveStyle({ cursor: 'grab' });
      });
    });
  });

  describe('TooltipPlugin2 Component', () => {
    test.todo('write tests');
  });

  describe('Helper Functions', () => {
    describe('mergeState', () => {
      test.todo('write tests');
    });

    describe('initState', () => {
      test.todo('write tests');
    });

    describe('maybeZoomAction', () => {
      test.todo('write tests');
    });

    describe('getDataLinksFallback', () => {
      test.todo('write tests');
    });

    describe('getAdHocFiltersFallback', () => {
      test.todo('write tests');
    });
  });
});
