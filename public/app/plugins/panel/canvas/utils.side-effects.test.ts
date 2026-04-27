// Tests utils.ts functions that require mocking due to module-level side effects
// (canvas registry imports at line 17 instantiate elements and reference global config).
// Pure functions without side effects are tested in utils.test.ts.

import { type DataFrame, type Field, FieldType } from '@grafana/data/dataframe';
import { PluginState } from '@grafana/data/types';
import { type CanvasElementItem, type CanvasElementOptions } from 'app/features/canvas/element';
import { type ElementState } from 'app/features/canvas/runtime/element';

import type * as UtilsModule from './utils';

jest.mock('app/core/config');

const setHasAlphaPanels = async (value: boolean) => {
  const appCoreConfig = await import('app/core/config');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (appCoreConfig as any).hasAlphaPanels = value;
};

describe('canvas utils - data transformations', () => {
  let getElementTypesOptions: typeof UtilsModule.getElementTypesOptions;
  let getElementTypes: typeof UtilsModule.getElementTypes;
  let isConnectionSource: typeof UtilsModule.isConnectionSource;
  let isConnectionTarget: typeof UtilsModule.isConnectionTarget;
  let getConnections: typeof UtilsModule.getConnections;
  let getElementFields: typeof UtilsModule.getElementFields;

  beforeAll(async () => {
    await setHasAlphaPanels(false);

    const utilsModule = await import('./utils');
    getElementTypesOptions = utilsModule.getElementTypesOptions;
    getElementTypes = utilsModule.getElementTypes;
    isConnectionSource = utilsModule.isConnectionSource;
    isConnectionTarget = utilsModule.isConnectionTarget;
    getConnections = utilsModule.getConnections;
    getElementFields = utilsModule.getElementFields;
  });

  describe('getElementTypes', () => {
    it('should return only default element types when shouldShowAdvancedTypes is false', () => {
      const result = getElementTypes(false, undefined);

      expect(result.options.length).toBeGreaterThan(0);
      expect(result.current).toEqual([]);
    });

    it('should return only default element types when shouldShowAdvancedTypes is undefined', () => {
      const result = getElementTypes(undefined, undefined);

      expect(result.options.length).toBeGreaterThan(0);
      expect(result.current).toEqual([]);
    });

    it('should return both default and advanced element types when shouldShowAdvancedTypes is true', () => {
      const resultWithoutAdvanced = getElementTypes(false, undefined);
      const resultWithAdvanced = getElementTypes(true, undefined);

      expect(resultWithAdvanced.options.length).toBeGreaterThan(resultWithoutAdvanced.options.length);
    });

    it('should mark current selection when provided', () => {
      const result = getElementTypes(false, 'text');

      expect(result.current.length).toBe(1);
      expect(result.current[0].value).toBe('text');
    });
  });

  describe('getElementTypesOptions', () => {
    it('should transform basic element items into selectable options', () => {
      const items: CanvasElementItem[] = [
        { id: 'rect', name: 'Rectangle', description: 'A rectangle' } as CanvasElementItem,
        { id: 'circle', name: 'Circle', description: 'A circle' } as CanvasElementItem,
      ];

      const result = getElementTypesOptions(items, undefined);

      expect(result.options).toEqual([
        { label: 'Rectangle', value: 'rect', description: 'A rectangle' },
        { label: 'Circle', value: 'circle', description: 'A circle' },
      ]);
      expect(result.current).toEqual([]);
    });

    it('should mark current selection', () => {
      const items: CanvasElementItem[] = [
        { id: 'rect', name: 'Rectangle', description: 'A rectangle' } as CanvasElementItem,
        { id: 'circle', name: 'Circle', description: 'A circle' } as CanvasElementItem,
      ];

      const result = getElementTypesOptions(items, 'circle');

      expect(result.current).toEqual([{ label: 'Circle', value: 'circle', description: 'A circle' }]);
    });

    it('should filter out alpha items when hasAlphaPanels is false', async () => {
      await setHasAlphaPanels(false);

      const items: CanvasElementItem[] = [
        { id: 'rect', name: 'Rectangle', description: 'A rectangle' } as CanvasElementItem,
        {
          id: 'alpha-item',
          name: 'Alpha Item',
          description: 'Alpha feature',
          state: PluginState.alpha,
        } as CanvasElementItem,
      ];

      const result = getElementTypesOptions(items, undefined);

      expect(result.options).toEqual([{ label: 'Rectangle', value: 'rect', description: 'A rectangle' }]);
    });

    it('should append alpha items at end when hasAlphaPanels is true', async () => {
      await setHasAlphaPanels(true);

      const items: CanvasElementItem[] = [
        { id: 'rect', name: 'Rectangle', description: 'A rectangle' } as CanvasElementItem,
        {
          id: 'alpha-item',
          name: 'Alpha Item',
          description: 'Alpha feature',
          state: PluginState.alpha,
        } as CanvasElementItem,
        { id: 'circle', name: 'Circle', description: 'A circle' } as CanvasElementItem,
      ];

      const result = getElementTypesOptions(items, undefined);

      expect(result.options).toEqual([
        { label: 'Rectangle', value: 'rect', description: 'A rectangle' },
        { label: 'Circle', value: 'circle', description: 'A circle' },
        { label: 'Alpha Item (Alpha)', value: 'alpha-item', description: 'Alpha feature' },
      ]);

      await setHasAlphaPanels(false);
    });

    it('should handle empty items array', () => {
      const result = getElementTypesOptions([], undefined);

      expect(result.options).toEqual([]);
      expect(result.current).toEqual([]);
    });
  });

  describe('isConnectionSource', () => {
    it('should return true when element has connections', () => {
      const element = {
        options: {
          connections: [{ targetName: 'target1' }],
        },
      } as unknown as ElementState;

      expect(isConnectionSource(element)).toBe(true);
    });

    it('should return false when element has empty connections array', () => {
      const element = {
        options: {
          connections: [],
        },
      } as unknown as ElementState;

      expect(isConnectionSource(element)).toBe(false);
    });

    it('should return falsy value when connections is undefined', () => {
      const element = {
        options: {
          connections: undefined,
        },
      } as unknown as ElementState;

      expect(isConnectionSource(element)).toBeFalsy();
    });
  });

  describe('getConnections', () => {
    it('should return empty array for empty map', () => {
      const sceneByName = new Map<string, ElementState>();

      const result = getConnections(sceneByName);

      expect(result).toEqual([]);
    });

    it('should build connection state for element with connections', () => {
      const source = {
        options: {
          connections: [
            {
              targetName: 'elem2',
              source: { x: 0, y: 0 },
              target: { x: 1, y: 1 },
              color: { fixed: 'red' },
              size: { fixed: 2, min: 1, max: 10 },
            },
          ],
        },
        parent: null,
      } as unknown as ElementState;
      const target = { options: {} } as unknown as ElementState;
      const sceneByName = new Map<string, ElementState>([
        ['elem1', source],
        ['elem2', target],
      ]);

      const result = getConnections(sceneByName);

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe(source);
      expect(result[0].target).toBe(target);
      expect(result[0].index).toBe(0);
    });

    it('should migrate old string color to object format', () => {
      const source = {
        options: {
          connections: [
            {
              targetName: 'elem2',
              color: 'blue',
            },
          ],
        },
        parent: null,
      } as unknown as ElementState;
      const target = { options: {} } as unknown as ElementState;
      const sceneByName = new Map<string, ElementState>([
        ['elem1', source],
        ['elem2', target],
      ]);

      const result = getConnections(sceneByName);

      expect(result[0].info.color).toEqual({ fixed: 'blue' });
    });

    it('should migrate old number size to object format', () => {
      const source = {
        options: {
          connections: [
            {
              targetName: 'elem2',
              size: 5,
            },
          ],
        },
        parent: null,
      } as unknown as ElementState;
      const target = { options: {} } as unknown as ElementState;
      const sceneByName = new Map<string, ElementState>([
        ['elem1', source],
        ['elem2', target],
      ]);

      const result = getConnections(sceneByName);

      expect(result[0].info.size).toEqual({ fixed: 2, min: 1, max: 10 });
    });

    it('should use parent as target when targetName is undefined', () => {
      const parent = { options: {} } as unknown as ElementState;
      const source = {
        options: {
          connections: [
            {
              source: { x: 0, y: 0 },
              target: { x: 1, y: 1 },
            },
          ],
        },
        parent,
      } as unknown as ElementState;
      const sceneByName = new Map<string, ElementState>([['elem1', source]]);

      const result = getConnections(sceneByName);

      expect(result).toHaveLength(1);
      expect(result[0].target).toBe(parent);
    });

    it('should skip connection when target not found and no parent', () => {
      const source = {
        options: {
          connections: [
            {
              targetName: 'nonexistent',
            },
          ],
        },
        parent: null,
      } as unknown as ElementState;
      const sceneByName = new Map<string, ElementState>([['elem1', source]]);

      const result = getConnections(sceneByName);

      expect(result).toEqual([]);
    });

    it('should include vertices, sourceOriginal, and targetOriginal when present', () => {
      const source = {
        options: {
          connections: [
            {
              targetName: 'elem2',
              vertices: [{ x: 0.5, y: 0.5 }],
              sourceOriginal: { x: 0, y: 0 },
              targetOriginal: { x: 1, y: 1 },
            },
          ],
        },
        parent: null,
      } as unknown as ElementState;
      const target = { options: {} } as unknown as ElementState;
      const sceneByName = new Map<string, ElementState>([
        ['elem1', source],
        ['elem2', target],
      ]);

      const result = getConnections(sceneByName);

      expect(result[0].vertices).toEqual([{ x: 0.5, y: 0.5 }]);
      expect(result[0].sourceOriginal).toEqual({ x: 0, y: 0 });
      expect(result[0].targetOriginal).toEqual({ x: 1, y: 1 });
    });

    it('should handle multiple connections from single element', () => {
      const source = {
        options: {
          connections: [{ targetName: 'elem2' }, { targetName: 'elem3' }],
        },
        parent: null,
      } as unknown as ElementState;
      const target2 = { options: {} } as unknown as ElementState;
      const target3 = { options: {} } as unknown as ElementState;
      const sceneByName = new Map<string, ElementState>([
        ['elem1', source],
        ['elem2', target2],
        ['elem3', target3],
      ]);

      const result = getConnections(sceneByName);

      expect(result).toHaveLength(2);
      expect(result[0].index).toBe(0);
      expect(result[1].index).toBe(1);
    });
  });

  describe('isConnectionTarget', () => {
    it('should return true when element is a connection target', () => {
      const target = { options: {} } as unknown as ElementState;
      const source = {
        options: {
          connections: [{ targetName: 'target' }],
        },
        parent: null,
      } as unknown as ElementState;
      const sceneByName = new Map<string, ElementState>([
        ['source', source],
        ['target', target],
      ]);

      const result = isConnectionTarget(target, sceneByName);

      expect(result).toBe(true);
    });

    it('should return false when element is not a connection target', () => {
      const notTarget = { options: {} } as unknown as ElementState;
      const source = {
        options: {
          connections: [{ targetName: 'someOtherElement' }],
        },
        parent: null,
      } as unknown as ElementState;
      const sceneByName = new Map<string, ElementState>([
        ['source', source],
        ['notTarget', notTarget],
        ['someOtherElement', { options: {} } as unknown as ElementState],
      ]);

      const result = isConnectionTarget(notTarget, sceneByName);

      expect(result).toBe(false);
    });

    it('should return false when no connections exist', () => {
      const element = { options: {} } as unknown as ElementState;
      const sceneByName = new Map<string, ElementState>([['element', element]]);

      const result = isConnectionTarget(element, sceneByName);

      expect(result).toBe(false);
    });
  });

  describe('getElementFields', () => {
    it('should return empty array when no matching fields', () => {
      const frames: DataFrame[] = [
        {
          fields: [
            { name: 'field1', type: FieldType.string, values: [], config: {} } as Field,
            { name: 'field2', type: FieldType.number, values: [], config: {} } as Field,
          ],
          length: 0,
        } as DataFrame,
      ];
      const opts: Partial<CanvasElementOptions> = {};

      const result = getElementFields(frames, opts as CanvasElementOptions);

      expect(result).toEqual([]);
    });

    it('should extract background color field', () => {
      const colorField = { name: 'color', type: FieldType.string, values: [], config: {} } as Field;
      const frames: DataFrame[] = [
        {
          fields: [colorField, { name: 'other', type: FieldType.string, values: [], config: {} } as Field],
          length: 0,
        } as DataFrame,
      ];
      const opts: Partial<CanvasElementOptions> = {
        background: { color: { field: 'color', fixed: 'red' } },
      };

      const result = getElementFields(frames, opts as CanvasElementOptions);

      expect(result).toEqual([colorField]);
    });

    it('should extract text and color config fields', () => {
      const textField = { name: 'text', type: FieldType.string, values: [], config: {} } as Field;
      const colorField = { name: 'color', type: FieldType.string, values: [], config: {} } as Field;
      const frames: DataFrame[] = [
        {
          fields: [textField, colorField, { name: 'other', type: FieldType.string, values: [], config: {} } as Field],
          length: 0,
        } as DataFrame,
      ];
      const opts: Partial<CanvasElementOptions> = {
        config: {
          text: { field: 'text' },
          color: { field: 'color' },
        },
      };

      const result = getElementFields(frames, opts as CanvasElementOptions);

      expect(result).toContain(textField);
      expect(result).toContain(colorField);
      expect(result).toHaveLength(2);
    });

    it('should deduplicate fields when same field matches multiple configs', () => {
      const colorField = { name: 'color', type: FieldType.string, values: [], config: {} } as Field;
      const frames: DataFrame[] = [
        {
          fields: [colorField, { name: 'other', type: FieldType.string, values: [], config: {} } as Field],
          length: 0,
        } as DataFrame,
      ];
      const opts: Partial<CanvasElementOptions> = {
        background: { color: { field: 'color', fixed: 'red' } },
        border: { color: { field: 'color', fixed: 'blue' } },
        config: {
          color: { field: 'color' },
        },
      };

      const result = getElementFields(frames, opts as CanvasElementOptions);

      expect(result).toEqual([colorField]);
    });

    it('should handle multiple frames', () => {
      const field1 = { name: 'field1', type: FieldType.string, values: [], config: {} } as Field;
      const field2 = { name: 'field2', type: FieldType.string, values: [], config: {} } as Field;
      const frames: DataFrame[] = [
        {
          fields: [field1],
          length: 0,
        } as DataFrame,
        {
          fields: [field2],
          length: 0,
        } as DataFrame,
      ];
      const opts: Partial<CanvasElementOptions> = {
        background: { color: { field: 'field1', fixed: 'red' } },
        config: {
          text: { field: 'field2' },
        },
      };

      const result = getElementFields(frames, opts as CanvasElementOptions);

      expect(result).toContain(field1);
      expect(result).toContain(field2);
      expect(result).toHaveLength(2);
    });

    it('should handle undefined config', () => {
      const frames: DataFrame[] = [
        {
          fields: [{ name: 'field1', type: FieldType.string, values: [], config: {} } as Field],
          length: 0,
        } as DataFrame,
      ];
      const opts: Partial<CanvasElementOptions> = {
        config: undefined,
      };

      const result = getElementFields(frames, opts as CanvasElementOptions);

      expect(result).toEqual([]);
    });
  });
});
