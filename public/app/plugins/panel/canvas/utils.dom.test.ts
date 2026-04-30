import { type ElementTransformAndDimensions } from './types';
import { getElementTransformAndDimensions } from './utils';

describe('canvas utils - DOM operations', () => {
  describe('getElementTransformAndDimensions', () => {
    const createMockElement = (
      transformMatrix: { m11: number; m12: number; m21: number; m22: number; m41: number; m42: number } | null,
      width: number,
      height: number
    ): Element => {
      const element = document.createElement('div');
      const transform = transformMatrix
        ? `matrix(${transformMatrix.m11}, ${transformMatrix.m12}, ${transformMatrix.m21}, ${transformMatrix.m22}, ${transformMatrix.m41}, ${transformMatrix.m42})`
        : 'none';

      const styles: Partial<CSSStyleDeclaration> = {
        transform,
        width: `${width}px`,
        height: `${height}px`,
      };

      jest.spyOn(window, 'getComputedStyle').mockReturnValue(styles as CSSStyleDeclaration);

      if (transformMatrix) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global as any).DOMMatrix = jest.fn().mockImplementation(() => transformMatrix);
      }

      return element;
    };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return default values when transform is none', () => {
      const element = createMockElement(null, 100, 50);

      const result = getElementTransformAndDimensions(element);

      expect(result).toEqual<ElementTransformAndDimensions>({
        left: 0,
        top: 0,
        width: 100,
        height: 50,
        x: 0,
        y: 0,
        rotation: 0,
      });
    });

    it('should parse translate transformation', () => {
      const element = createMockElement({ m11: 1, m12: 0, m21: 0, m22: 1, m41: 50, m42: 100 }, 100, 50);

      const result = getElementTransformAndDimensions(element);

      expect(result.left).toBe(50);
      expect(result.top).toBe(100);
      expect(result.x).toBe(50);
      expect(result.y).toBe(100);
      expect(result.width).toBe(100);
      expect(result.height).toBe(50);
      expect(result.rotation).toBeCloseTo(0, 5);
    });

    it('should parse rotation transformation (90 degrees)', () => {
      const element = createMockElement({ m11: 0, m12: 1, m21: -1, m22: 0, m41: 0, m42: 0 }, 100, 50);

      const result = getElementTransformAndDimensions(element);

      expect(result.rotation).toBeCloseTo(90, 1);
      expect(result.left).toBe(0);
      expect(result.top).toBe(0);
    });

    it('should parse rotation transformation (45 degrees)', () => {
      const cos45 = Math.cos((45 * Math.PI) / 180);
      const sin45 = Math.sin((45 * Math.PI) / 180);
      const element = createMockElement({ m11: cos45, m12: sin45, m21: -sin45, m22: cos45, m41: 0, m42: 0 }, 100, 50);

      const result = getElementTransformAndDimensions(element);

      expect(result.rotation).toBeCloseTo(45, 1);
    });

    it('should parse combined translate and rotate transformation', () => {
      const cos30 = Math.cos((30 * Math.PI) / 180);
      const sin30 = Math.sin((30 * Math.PI) / 180);
      const element = createMockElement(
        { m11: cos30, m12: sin30, m21: -sin30, m22: cos30, m41: 75, m42: 150 },
        200,
        100
      );

      const result = getElementTransformAndDimensions(element);

      expect(result.left).toBe(75);
      expect(result.top).toBe(150);
      expect(result.x).toBe(75);
      expect(result.y).toBe(150);
      expect(result.width).toBe(200);
      expect(result.height).toBe(100);
      expect(result.rotation).toBeCloseTo(30, 1);
    });

    it('should handle floating point dimensions', () => {
      const element = createMockElement(null, 123.45, 67.89);

      const result = getElementTransformAndDimensions(element);

      expect(result.width).toBeCloseTo(123.45, 2);
      expect(result.height).toBeCloseTo(67.89, 2);
    });
  });
});
