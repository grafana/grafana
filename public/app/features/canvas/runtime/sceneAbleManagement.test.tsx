import InfiniteViewer from 'infinite-viewer';
import Moveable from 'moveable';
import Selecto from 'selecto';

import { config } from 'app/core/config';
import { HorizontalConstraint, VerticalConstraint } from 'app/plugins/panel/canvas/panelcfg.gen';

import { ElementState } from './element';
import { Scene } from './scene';
import { initMoveable } from './sceneAbleManagement';

// Mock external dependencies
jest.mock('infinite-viewer');
jest.mock('moveable');
jest.mock('selecto');
jest.mock('app/core/config');

// Mock DOM APIs
Object.defineProperty(window, 'getComputedStyle', {
  value: jest.fn(() => ({
    width: '100px',
    height: '100px',
    transform: 'translate(10px, 20px)',
  })),
});

// Mock getBoundingClientRect
Element.prototype.getBoundingClientRect = jest.fn(() => ({
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  top: 0,
  left: 0,
  bottom: 100,
  right: 100,
  toJSON: jest.fn(),
}));

const MockedMoveable = Moveable as jest.MockedClass<typeof Moveable>;
const MockedSelecto = Selecto as jest.MockedClass<typeof Selecto>;
const MockedInfiniteViewer = InfiniteViewer as jest.MockedClass<typeof InfiniteViewer>;

describe('sceneAbleManagement', () => {
  let mockScene: Scene;
  let mockElement: ElementState;
  // let mockFrameElement: FrameState;
  let mockDiv: HTMLDivElement;
  let mockViewerDiv: HTMLDivElement;
  let mockViewportDiv: HTMLDivElement;
  let mockMoveable: jest.Mocked<Partial<Moveable>>;
  let mockSelecto: jest.Mocked<Partial<Selecto>>;
  let mockInfiniteViewer: jest.Mocked<Partial<InfiniteViewer>>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock config
    config.featureToggles = {
      canvasPanelPanZoom: false,
    };

    // Create mock DOM elements
    mockDiv = document.createElement('div');
    mockViewerDiv = document.createElement('div');
    mockViewportDiv = document.createElement('div');

    // Create mock moveable instance
    mockMoveable = {
      on: jest.fn().mockReturnThis(),
      props: {},
      isMoveableElement: jest.fn(),
      dragStart: jest.fn(),
      elementGuidelines: [],
      target: null,
    };

    // Create mock selecto instance
    mockSelecto = {
      on: jest.fn().mockReturnThis(),
      destroy: jest.fn(),
      getSelectedTargets: jest.fn(() => []),
      setSelectedTargets: jest.fn(),
      clickTarget: jest.fn(),
    };

    // Create mock infinite viewer instance
    mockInfiniteViewer = {
      on: jest.fn().mockReturnThis(),
      setZoom: jest.fn(),
      scrollTo: jest.fn(),
      getZoom: jest.fn(() => 1),
      getScrollLeft: jest.fn(() => 0),
      getScrollTop: jest.fn(() => 0),
    };

    // Mock constructors
    MockedMoveable.mockImplementation(() => mockMoveable as Moveable);
    MockedSelecto.mockImplementation(() => mockSelecto as Selecto);
    MockedInfiniteViewer.mockImplementation(() => mockInfiniteViewer as InfiniteViewer);

    // Create mock element
    mockElement = {
      div: mockDiv,
      applyDrag: jest.fn(),
      applyResize: jest.fn(),
      applyRotate: jest.fn(),
      setPlacementFromConstraint: jest.fn(),
      options: {
        placement: { width: 100, height: 100, top: 0, left: 0, rotation: 0 },
        constraint: {
          vertical: VerticalConstraint.Top,
          horizontal: HorizontalConstraint.Left,
        },
      },
      item: { hasEditMode: false },
    } as unknown as ElementState;

    // Create mock scene
    mockScene = {
      div: mockDiv,
      viewerDiv: mockViewerDiv,
      viewportDiv: mockViewportDiv,
      root: {
        div: mockDiv,
        elements: [mockElement],
      },
      connections: {
        connectionsNeedUpdate: jest.fn(() => false),
        connectionAnchorDiv: { style: { display: 'none' } },
        handleConnectionDragStart: jest.fn(),
        handleVertexDragStart: jest.fn(),
        handleVertexAddDragStart: jest.fn(),
      },
      moved: { next: jest.fn() },
      editModeEnabled: {
        getValue: jest.fn(() => false),
        next: jest.fn(),
      },
      isEditingEnabled: true,
      shouldPanZoom: true,
      scale: 1,
      scrollLeft: 0,
      scrollTop: 0,
      width: 800,
      height: 600,
      updateSelection: jest.fn(),
      clearCurrentSelection: jest.fn(),
      updateConnectionsSize: jest.fn(),
      setNonTargetPointerEvents: jest.fn(),
      ignoreDataUpdate: false,
      openContextMenu: jest.fn(),
      contextMenuOnVisibilityChange: jest.fn(),
      moveableActionCallback: jest.fn(),
    } as unknown as Scene;
  });

  describe('initMoveable', () => {
    it('should initialize moveable and selecto with correct configuration', () => {
      initMoveable(false, true, mockScene);

      expect(MockedSelecto).toHaveBeenCalledWith({
        rootContainer: mockScene.div,
        dragContainer: mockScene.div,
        selectableTargets: [mockDiv],
        toggleContinueSelect: 'shift',
        selectFromInside: false,
        hitRate: 0,
      });

      expect(MockedMoveable).toHaveBeenCalled();
      expect(mockScene.selecto).toBe(mockSelecto);
      expect(mockScene.moveable).toBe(mockMoveable);
    });

    it('should initialize with pan-zoom configuration when feature toggle is enabled', () => {
      config.featureToggles.canvasPanelPanZoom = true;

      initMoveable(false, true, mockScene);

      expect(MockedSelecto).toHaveBeenCalledWith({
        rootContainer: mockScene.viewerDiv,
        dragContainer: mockScene.viewerDiv,
        selectableTargets: [mockDiv],
        toggleContinueSelect: 'shift',
        selectFromInside: false,
        hitRate: 0,
      });

      expect(MockedInfiniteViewer).toHaveBeenCalledWith(
        mockScene.viewerDiv,
        mockScene.viewportDiv,
        expect.objectContaining({
          preventWheelClick: false,
          useAutoZoom: true,
          useMouseDrag: false,
          useWheelScroll: mockScene.shouldPanZoom,
          displayHorizontalScroll: false,
          displayVerticalScroll: false,
        })
      );

      expect(mockScene.infiniteViewer).toBe(mockInfiniteViewer);
      expect(mockInfiniteViewer.setZoom).toHaveBeenCalledWith(1);
      expect(mockInfiniteViewer.scrollTo).toHaveBeenCalledWith(0, 0);
    });

    it('should destroy existing selecto when destroySelecto is true', () => {
      mockScene.selecto = mockSelecto as Selecto;

      initMoveable(true, true, mockScene);

      expect(mockSelecto.destroy).toHaveBeenCalled();
    });

    it('should configure moveable with proper event handlers', () => {
      initMoveable(false, true, mockScene);

      expect(mockMoveable.on).toHaveBeenCalledWith('rotateStart', expect.any(Function));
      expect(mockMoveable.on).toHaveBeenCalledWith('rotate', expect.any(Function));
      expect(mockMoveable.on).toHaveBeenCalledWith('rotateGroup', expect.any(Function));
      expect(mockMoveable.on).toHaveBeenCalledWith('rotateEnd', expect.any(Function));
      expect(mockMoveable.on).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockMoveable.on).toHaveBeenCalledWith('clickGroup', expect.any(Function));
      expect(mockMoveable.on).toHaveBeenCalledWith('dragStart', expect.any(Function));
      expect(mockMoveable.on).toHaveBeenCalledWith('dragGroupStart', expect.any(Function));
      expect(mockMoveable.on).toHaveBeenCalledWith('drag', expect.any(Function));
      expect(mockMoveable.on).toHaveBeenCalledWith('dragGroup', expect.any(Function));
      expect(mockMoveable.on).toHaveBeenCalledWith('dragEnd', expect.any(Function));
      expect(mockMoveable.on).toHaveBeenCalledWith('dragGroupEnd', expect.any(Function));
      expect(mockMoveable.on).toHaveBeenCalledWith('resizeStart', expect.any(Function));
      expect(mockMoveable.on).toHaveBeenCalledWith('resizeGroupStart', expect.any(Function));
      expect(mockMoveable.on).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(mockMoveable.on).toHaveBeenCalledWith('resizeGroup', expect.any(Function));
      expect(mockMoveable.on).toHaveBeenCalledWith('resizeEnd', expect.any(Function));
      expect(mockMoveable.on).toHaveBeenCalledWith('resizeGroupEnd', expect.any(Function));
    });

    it('should configure selecto with proper event handlers', () => {
      initMoveable(false, true, mockScene);

      expect(mockSelecto.on).toHaveBeenCalledWith('dragStart', expect.any(Function));
      expect(mockSelecto.on).toHaveBeenCalledWith('select', expect.any(Function));
      expect(mockSelecto.on).toHaveBeenCalledWith('selectEnd', expect.any(Function));
      expect(mockSelecto.on).toHaveBeenCalledWith('dragEnd', expect.any(Function));
    });
  });

  describe('Moveable Configuration', () => {
    it('should configure moveable with correct options', () => {
      initMoveable(false, true, mockScene);

      expect(MockedMoveable).toHaveBeenCalledWith(
        mockScene.div,
        expect.objectContaining({
          draggable: true,
          resizable: true,
          rotatable: true,
          snappable: true,
          origin: false,
        })
      );
    });

    it('should configure moveable for pan-zoom mode', () => {
      config.featureToggles.canvasPanelPanZoom = true;
      initMoveable(false, true, mockScene);

      expect(MockedMoveable).toHaveBeenCalledWith(
        mockScene.viewerDiv,
        expect.objectContaining({
          draggable: true,
          resizable: true,
          rotatable: true,
          snappable: true,
          origin: false,
        })
      );
    });

    it('should register all required moveable event handlers', () => {
      initMoveable(false, true, mockScene);

      const expectedEvents = [
        'rotateStart',
        'rotate',
        'rotateGroup',
        'rotateEnd',
        'click',
        'clickGroup',
        'dragStart',
        'dragGroupStart',
        'drag',
        'dragGroup',
        'dragEnd',
        'dragGroupEnd',
        'resizeStart',
        'resizeGroupStart',
        'resize',
        'resizeGroup',
        'resizeEnd',
        'resizeGroupEnd',
      ];

      expectedEvents.forEach((eventName) => {
        expect(mockMoveable.on).toHaveBeenCalledWith(eventName, expect.any(Function));
      });
    });

    it('should disable dragging when allowChanges is false', () => {
      initMoveable(false, false, mockScene);

      expect(MockedMoveable).toHaveBeenCalledWith(
        mockScene.div,
        expect.objectContaining({
          draggable: false,
          resizable: false,
          rotatable: false,
          snappable: false,
        })
      );
    });
  });

  describe('Selecto Configuration', () => {
    it('should configure selecto with correct options', () => {
      initMoveable(false, true, mockScene);

      expect(MockedSelecto).toHaveBeenCalledWith({
        rootContainer: mockScene.div,
        dragContainer: mockScene.div,
        selectableTargets: [mockDiv],
        toggleContinueSelect: 'shift',
        selectFromInside: false,
        hitRate: 0,
      });
    });

    it('should register all required selecto event handlers', () => {
      initMoveable(false, true, mockScene);

      const expectedEvents = ['dragStart', 'select', 'selectEnd', 'dragEnd'];

      expectedEvents.forEach((eventName) => {
        expect(mockSelecto.on).toHaveBeenCalledWith(eventName, expect.any(Function));
      });
    });
  });

  describe('InfiniteViewer Event Handlers', () => {
    beforeEach(() => {
      config.featureToggles.canvasPanelPanZoom = true;
      mockScene.viewerDiv = mockViewerDiv;
      mockScene.viewportDiv = mockViewportDiv;
    });

    it('should handle context menu events', () => {
      initMoveable(false, true, mockScene);

      const contextMenuEvent = new Event('contextmenu') as MouseEvent;
      contextMenuEvent.preventDefault = jest.fn();
      Object.defineProperty(contextMenuEvent, 'pageX', { value: 100 });
      Object.defineProperty(contextMenuEvent, 'pageY', { value: 200 });

      mockViewerDiv.dispatchEvent(contextMenuEvent);

      expect(contextMenuEvent.preventDefault).toHaveBeenCalled();
      expect(mockScene.openContextMenu).toHaveBeenCalledWith({ x: 100, y: 200 });
    });

    it('should handle middle mouse button panning', () => {
      initMoveable(false, true, mockScene);

      const mouseDownEvent = new MouseEvent('mousedown', { button: 1 });
      jest.spyOn(mouseDownEvent, 'preventDefault');

      mockViewerDiv.dispatchEvent(mouseDownEvent);

      expect(mouseDownEvent.preventDefault).toHaveBeenCalled();
    });

    it('should handle double click zoom reset', () => {
      initMoveable(false, true, mockScene);

      const dblClickEvent = new MouseEvent('dblclick');
      mockViewerDiv.dispatchEvent(dblClickEvent);

      expect(mockInfiniteViewer.setZoom).toHaveBeenCalledWith(1);
      expect(mockInfiniteViewer.scrollTo).toHaveBeenCalledWith(0, 0);
    });

    it('should handle wheel events when pan/zoom is disabled', () => {
      mockScene.shouldPanZoom = false;
      initMoveable(false, true, mockScene);

      const wheelEvent = new WheelEvent('wheel');
      jest.spyOn(wheelEvent, 'stopImmediatePropagation');
      jest.spyOn(wheelEvent, 'preventDefault');

      mockViewportDiv.dispatchEvent(wheelEvent);

      expect(wheelEvent.stopImmediatePropagation).toHaveBeenCalled();
      expect(wheelEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe('Custom Ables Integration', () => {
    it('should include custom ables in moveable configuration', () => {
      initMoveable(false, true, mockScene);

      expect(MockedMoveable).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          ables: expect.any(Array),
          props: expect.objectContaining({
            dimensionViewable: true,
            constraintViewable: true,
            settingsViewable: true,
          }),
        })
      );
    });

    it('should disable custom ables when allowChanges is false', () => {
      initMoveable(false, false, mockScene);

      expect(MockedMoveable).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          props: expect.objectContaining({
            dimensionViewable: false,
            constraintViewable: false,
            settingsViewable: false,
          }),
        })
      );
    });
  });

  describe('Snapping Guidelines', () => {
    it('should include element guidelines in moveable configuration', () => {
      initMoveable(false, true, mockScene);

      expect(MockedMoveable).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          elementGuidelines: [mockDiv],
          snapDirections: expect.objectContaining({
            top: true,
            left: true,
            bottom: true,
            right: true,
            center: true,
            middle: true,
          }),
        })
      );
    });
  });

  describe('Scene Integration', () => {
    it('should assign moveable and selecto to scene', () => {
      initMoveable(false, true, mockScene);

      expect(mockScene.moveable).toBe(mockMoveable);
      expect(mockScene.selecto).toBe(mockSelecto);
    });

    it('should initialize infinite viewer when pan-zoom is enabled', () => {
      config.featureToggles.canvasPanelPanZoom = true;
      initMoveable(false, true, mockScene);

      expect(mockScene.infiniteViewer).toBe(mockInfiniteViewer);
      expect(MockedInfiniteViewer).toHaveBeenCalledWith(
        mockScene.viewerDiv,
        mockScene.viewportDiv,
        expect.objectContaining({
          useWheelScroll: mockScene.shouldPanZoom,
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle missing scene properties gracefully', () => {
      const incompleteScene = {
        root: { elements: [] },
        connections: { connectionsNeedUpdate: jest.fn(() => false) },
        moved: { next: jest.fn() },
        editModeEnabled: {
          getValue: jest.fn(() => false),
          next: jest.fn(),
        },
        isEditingEnabled: true,
        updateSelection: jest.fn(),
      } as unknown as Scene;

      expect(() => initMoveable(false, true, incompleteScene)).not.toThrow();
    });

    it('should handle elements without div property', () => {
      const elementWithoutDiv = { ...mockElement, div: undefined } as ElementState;
      mockScene.root.elements = [elementWithoutDiv];

      expect(() => initMoveable(false, true, mockScene)).not.toThrow();
    });
  });

  describe('Pan-Zoom Feature Toggle', () => {
    it('should use different containers based on feature toggle', () => {
      // Test without pan-zoom
      config.featureToggles.canvasPanelPanZoom = false;
      initMoveable(false, true, mockScene);

      expect(MockedSelecto).toHaveBeenCalledWith(
        expect.objectContaining({
          rootContainer: mockScene.div,
          dragContainer: mockScene.div,
        })
      );

      jest.clearAllMocks();

      // Test with pan-zoom
      config.featureToggles.canvasPanelPanZoom = true;
      initMoveable(false, true, mockScene);

      expect(MockedSelecto).toHaveBeenCalledWith(
        expect.objectContaining({
          rootContainer: mockScene.viewerDiv,
          dragContainer: mockScene.viewerDiv,
        })
      );
    });
  });
});
