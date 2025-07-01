import { CanvasFrameOptions } from '../frame';
import { DEFAULT_CANVAS_ELEMENT_CONFIG } from '../registry';
import { Scene } from './scene';

const mockRoot = {
  background: {
    color: {
      fixed: 'transparent',
    },
    image: {
      field: '',
      fixed: '',
      mode: 'fixed',
    },
    size: 'fill',
  },
  border: {
    color: {
      fixed: 'dark-green',
    },
  },
  constraint: {
    horizontal: 'left',
    vertical: 'top',
  },
  elements: [
    {
      background: {
        color: {
          field: 'A-series',
          fixed: '#D9D9D9',
        },
      },
      border: {
        color: {
          fixed: 'dark-green',
        },
      },
      config: {
        align: 'center',
        color: {
          fixed: '#000000',
        },
        size: 20,
        text: {
          field: 'A-series',
          fixed: '',
          mode: 'field',
        },
        valign: 'middle',
      },
      constraint: {
        horizontal: 'left',
        vertical: 'top',
      },
      links: [],
      name: 'Element 1',
      placement: {
        height: 50,
        left: 214,
        rotation: 0,
        top: 134,
        width: 260,
      },
      type: 'metric-value',
    },
    {
      background: {
        color: {
          field: 'A-series',
          fixed: '#D9D9D9',
        },
      },
      border: {
        color: {
          fixed: 'dark-green',
        },
      },
      config: {
        align: 'center',
        color: {
          fixed: '#000000',
        },
        size: 20,
        text: {
          field: 'A-series',
          fixed: '',
          mode: 'field',
        },
        valign: 'middle',
      },
      connections: [
        {
          color: {
            fixed: 'rgb(204, 204, 220)',
          },
          path: 'straight',
          size: {
            fixed: 2,
            max: 10,
            min: 1,
          },
          source: {
            x: -1,
            y: 0,
          },
          sourceOriginal: {
            x: 703,
            y: 426,
          },
          target: {
            x: 1,
            y: 0,
          },
          targetName: 'Element 4',
          targetOriginal: {
            x: 258,
            y: 384,
          },
        },
      ],
      constraint: {
        horizontal: 'right',
        vertical: 'bottom',
      },
      links: [],
      name: 'Element 2',
      placement: {
        bottom: 75,
        height: 50,
        right: 100,
        rotation: 0,
        width: 260,
      },
      type: 'metric-value',
    },
    {
      background: {
        color: {
          fixed: 'orange',
        },
      },
      border: {
        color: {
          fixed: 'dark-green',
        },
      },
      config: {
        align: 'center',
        color: {
          fixed: '#000000',
        },
        valign: 'middle',
      },
      constraint: {
        horizontal: 'right',
        vertical: 'top',
      },
      links: [],
      name: 'Element 3',
      placement: {
        height: 70,
        right: 111,
        rotation: 0,
        top: 89,
        width: 80,
      },
      type: 'triangle',
    },
    {
      background: {
        color: {
          fixed: 'blue',
        },
      },
      border: {
        color: {
          fixed: 'dark-green',
        },
      },
      config: {
        align: 'center',
        color: {
          fixed: '#000000',
        },
        valign: 'middle',
      },
      constraint: {
        horizontal: 'left',
        vertical: 'bottom',
      },
      links: [],
      name: 'Element 4',
      placement: {
        bottom: 62,
        height: 160,
        left: 98,
        rotation: 0,
        width: 160,
      },
      type: 'ellipse',
    },
  ],
  name: 'Element 1746614186867',
  placement: {
    height: 100,
    left: 0,
    rotation: 0,
    top: 0,
    width: 100,
  },
  type: 'frame',
};

describe('Scene', () => {
  let mockOnSave: jest.Mock;
  let mockPanel: any;

  beforeEach(() => {
    mockOnSave = jest.fn();
    mockPanel = { props: { replaceVariables: jest.fn() } };
  });

  describe('Initialization', () => {
    it('should initialize with default properties', () => {
      const config: CanvasFrameOptions = {
        name: 'Test Scene',
        type: 'frame',
        elements: [DEFAULT_CANVAS_ELEMENT_CONFIG],
      };

      const scene = new Scene(config, true, false, false, false, mockOnSave, mockPanel);

      expect(scene.revId).toBe(0);
      expect(scene.root).toBeDefined();
    });

    it('should initialize with complex mock data', () => {
      const scene = new Scene(mockRoot as CanvasFrameOptions, true, false, false, false, mockOnSave, mockPanel);

      expect(scene.root).toBeDefined();
      expect(scene.root.elements).toHaveLength(4);
      expect(scene.root.elements[0].options.name).toBe('Element 1');
      expect(scene.root.elements[0].options.type).toBe('metric-value');
    });

    it('should initialize with correct editing state', () => {
      const scene = new Scene(mockRoot as CanvasFrameOptions, true, false, false, false, mockOnSave, mockPanel);
      expect(scene.isEditingEnabled).toBe(true);

      const nonEditableScene = new Scene(
        mockRoot as CanvasFrameOptions,
        false,
        false,
        false,
        false,
        mockOnSave,
        mockPanel
      );
      expect(nonEditableScene.isEditingEnabled).toBe(false);
    });
  });

  describe('Element Management', () => {
    let scene: Scene;

    beforeEach(() => {
      scene = new Scene(mockRoot as CanvasFrameOptions, true, false, false, false, mockOnSave, mockPanel);
    });

    it('should find element by name using byName map', () => {
      const element = scene.byName.get('Element 1');
      expect(element).toBeDefined();
      expect(element?.getName()).toBe('Element 1');
      expect(element?.options.type).toBe('metric-value');
    });

    it('should return undefined for non-existent element', () => {
      const element = scene.byName.get('Non-existent Element');
      expect(element).toBeUndefined();
    });

    it('should get all elements in the scene', () => {
      const elements = scene.root.elements;
      expect(elements).toHaveLength(4);

      const elementNames = elements.map((el) => el.getName());
      expect(elementNames).toContain('Element 1');
      expect(elementNames).toContain('Element 2');
      expect(elementNames).toContain('Element 3');
      expect(elementNames).toContain('Element 4');
    });
  });

  describe('Element Properties and Placement', () => {
    let scene: Scene;

    beforeEach(() => {
      scene = new Scene(mockRoot as CanvasFrameOptions, true, false, false, false, mockOnSave, mockPanel);
    });

    it('should correctly handle elements with different placement types', () => {
      const element1 = scene.byName.get('Element 1');
      const element2 = scene.byName.get('Element 2');
      const element3 = scene.byName.get('Element 3');
      const element4 = scene.byName.get('Element 4');

      // Element 1 uses left/top positioning
      expect(element1?.options.placement).toEqual({
        height: 50,
        left: 214,
        rotation: 0,
        top: 134,
        width: 260,
      });

      // Element 2 uses right/bottom positioning
      expect(element2?.options.placement).toEqual({
        bottom: 75,
        height: 50,
        right: 100,
        rotation: 0,
        width: 260,
      });

      // Element 3 uses right/top positioning
      expect(element3?.options.placement).toEqual({
        height: 70,
        right: 111,
        rotation: 0,
        top: 89,
        width: 80,
      });

      // Element 4 uses left/bottom positioning
      expect(element4?.options.placement).toEqual({
        bottom: 62,
        height: 160,
        left: 98,
        rotation: 0,
        width: 160,
      });
    });

    it('should correctly identify different element types', () => {
      const element1 = scene.byName.get('Element 1');
      const element2 = scene.byName.get('Element 2');
      const element3 = scene.byName.get('Element 3');
      const element4 = scene.byName.get('Element 4');

      expect(element1?.options.type).toBe('metric-value');
      expect(element2?.options.type).toBe('metric-value');
      expect(element3?.options.type).toBe('triangle');
      expect(element4?.options.type).toBe('ellipse');
    });

    it('should handle element background and border properties', () => {
      const element3 = scene.byName.get('Element 3');
      const element4 = scene.byName.get('Element 4');

      expect(element3?.options.background?.color?.fixed).toBe('orange');
      expect(element4?.options.background?.color?.fixed).toBe('blue');

      expect(element3?.options.border?.color?.fixed).toBe('dark-green');
      expect(element4?.options.border?.color?.fixed).toBe('dark-green');
    });
  });

  describe('Element Connections', () => {
    let scene: Scene;

    beforeEach(() => {
      scene = new Scene(mockRoot as CanvasFrameOptions, true, false, false, false, mockOnSave, mockPanel);
    });

    it('should handle element with connections', () => {
      const element2 = scene.byName.get('Element 2');

      expect(element2?.options.connections).toBeDefined();
      expect(element2?.options.connections).toHaveLength(1);

      const connection = element2?.options.connections?.[0];
      expect(connection?.targetName).toBe('Element 4');
      expect(connection?.path).toBe('straight');
      expect(connection?.color?.fixed).toBe('rgb(204, 204, 220)');
      expect(connection?.size?.fixed).toBe(2);
    });

    it('should handle elements without connections', () => {
      const element1 = scene.byName.get('Element 1');
      const element3 = scene.byName.get('Element 3');
      const element4 = scene.byName.get('Element 4');

      expect(element1?.options.connections).toBeUndefined();
      expect(element3?.options.connections).toBeUndefined();
      expect(element4?.options.connections).toBeUndefined();
    });

    it('should validate connection coordinates', () => {
      const element2 = scene.byName.get('Element 2');
      const connection = element2?.options.connections?.[0];

      expect(connection?.source).toEqual({ x: -1, y: 0 });
      expect(connection?.target).toEqual({ x: 1, y: 0 });
      expect(connection?.sourceOriginal).toEqual({ x: 703, y: 426 });
      expect(connection?.targetOriginal).toEqual({ x: 258, y: 384 });
    });
  });

  describe('Scene State Management', () => {
    let scene: Scene;

    beforeEach(() => {
      scene = new Scene(mockRoot as CanvasFrameOptions, true, false, false, false, mockOnSave, mockPanel);
    });

    it('should get save model with all elements', () => {
      const saveModel = scene.root.getSaveModel();

      expect(saveModel.elements).toHaveLength(4);
      expect(saveModel.name).toBe(mockRoot.name);
      expect(saveModel.type).toBe('frame');
      expect(saveModel.background).toEqual(mockRoot.background);
      expect(saveModel.border).toEqual(mockRoot.border);
    });

    it('should maintain element integrity during updates', () => {
      const originalElements = scene.root.elements.map((el) => ({
        name: el.getName(),
        type: el.options.type,
      }));

      scene.root.onChange(scene.root.getSaveModel());

      const updatedElements = scene.root.elements.map((el) => ({
        name: el.getName(),
        type: el.options.type,
      }));

      expect(updatedElements).toEqual(originalElements);
    });
  });

  describe('Scene Constraints and Layout', () => {
    let scene: Scene;

    beforeEach(() => {
      scene = new Scene(mockRoot as CanvasFrameOptions, true, false, false, false, mockOnSave, mockPanel);
    });

    it('should handle different constraint types', () => {
      const element1 = scene.byName.get('Element 1');
      const element2 = scene.byName.get('Element 2');
      const element3 = scene.byName.get('Element 3');
      const element4 = scene.byName.get('Element 4');

      expect(element1?.options.constraint).toEqual({
        horizontal: 'left',
        vertical: 'top',
      });

      expect(element2?.options.constraint).toEqual({
        horizontal: 'right',
        vertical: 'bottom',
      });

      expect(element3?.options.constraint).toEqual({
        horizontal: 'right',
        vertical: 'top',
      });

      expect(element4?.options.constraint).toEqual({
        horizontal: 'left',
        vertical: 'bottom',
      });
    });

    it('should handle root frame constraints', () => {
      expect(scene.root.options.constraint).toEqual({
        horizontal: 'left',
        vertical: 'top',
      });
    });
  });

  describe('Element Configuration', () => {
    let scene: Scene;

    beforeEach(() => {
      scene = new Scene(mockRoot as CanvasFrameOptions, true, false, false, false, mockOnSave, mockPanel);
    });

    it('should handle metric-value element configuration', () => {
      const element1 = scene.byName.get('Element 1');
      const element2 = scene.byName.get('Element 2');

      expect(element1?.options.config).toEqual({
        align: 'center',
        color: { fixed: '#000000' },
        size: 20,
        text: {
          field: 'A-series',
          fixed: '',
          mode: 'field',
        },
        valign: 'middle',
      });

      expect(element2?.options.config).toEqual({
        align: 'center',
        color: { fixed: '#000000' },
        size: 20,
        text: {
          field: 'A-series',
          fixed: '',
          mode: 'field',
        },
        valign: 'middle',
      });
    });

    it('should handle shape element configuration', () => {
      const element3 = scene.byName.get('Element 3');
      const element4 = scene.byName.get('Element 4');

      expect(element3?.options.config).toEqual({
        align: 'center',
        color: { fixed: '#000000' },
        valign: 'middle',
      });

      expect(element4?.options.config).toEqual({
        align: 'center',
        color: { fixed: '#000000' },
        valign: 'middle',
      });
    });
  });

  describe('Scene Validation', () => {
    it('should handle empty scene', () => {
      const emptyConfig: CanvasFrameOptions = {
        name: 'Empty Scene',
        type: 'frame',
        elements: [],
      };

      const scene = new Scene(emptyConfig, true, false, false, false, mockOnSave, mockPanel);

      expect(scene.root.elements).toHaveLength(0);
      expect(scene.root.options.name).toBe('Empty Scene');
    });

    it('should handle malformed element data gracefully', () => {
      const malformedConfig = {
        ...mockRoot,
        elements: [
          ...mockRoot.elements,
          {
            name: 'Malformed Element',
            type: 'unknown-type',
            // Missing required properties
          },
        ],
      };

      expect(() => {
        new Scene(malformedConfig as CanvasFrameOptions, true, false, false, false, mockOnSave, mockPanel);
      }).not.toThrow();
    });
  });

  describe('Element Links', () => {
    let scene: Scene;

    beforeEach(() => {
      scene = new Scene(mockRoot as CanvasFrameOptions, true, false, false, false, mockOnSave, mockPanel);
    });

    it('should handle elements with empty links arrays', () => {
      const elements = scene.root.elements;

      elements.forEach((element) => {
        expect(element.options.links).toEqual([]);
      });
    });

    it('should support adding links to elements', () => {
      const element1 = scene.byName.get('Element 1');

      if (element1) {
        const linkData = {
          title: 'Test Link',
          url: 'https://example.com',
          targetBlank: true,
        };

        element1.options.links = [linkData];

        expect(element1.options.links).toHaveLength(1);
        expect(element1.options.links[0]).toEqual(linkData);
      }
    });
  });
});
