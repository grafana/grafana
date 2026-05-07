import { calculateMidpoint, calculateAbsoluteCoords, calculateAngle, calculateDistance } from './utils';

describe('canvas utils', () => {
  describe('calculateMidpoint', () => {
    const testCases = [
      {
        name: 'should calculate midpoint of horizontal line',
        input: [0, 0, 10, 0] as const,
        expected: { x: 5, y: 0 },
      },
      {
        name: 'should calculate midpoint of vertical line',
        input: [0, 0, 0, 10] as const,
        expected: { x: 0, y: 5 },
      },
      {
        name: 'should calculate midpoint of diagonal line',
        input: [0, 0, 10, 10] as const,
        expected: { x: 5, y: 5 },
      },
      {
        name: 'should handle negative coordinates',
        input: [-10, -10, 10, 10] as const,
        expected: { x: 0, y: 0 },
      },
      {
        name: 'should handle negative to positive transition',
        input: [-5, -5, 5, 5] as const,
        expected: { x: 0, y: 0 },
      },
      {
        name: 'should handle floating point coordinates',
        input: [1.5, 2.5, 3.5, 4.5] as const,
        expected: { x: 2.5, y: 3.5 },
      },
      {
        name: 'should handle same point (zero distance)',
        input: [5, 5, 5, 5] as const,
        expected: { x: 5, y: 5 },
      },
    ];

    testCases.forEach(({ name, input, expected }) => {
      it(name, () => {
        const [x1, y1, x2, y2] = input;
        expect(calculateMidpoint(x1, y1, x2, y2)).toEqual(expected);
      });
    });
  });

  describe('calculateAbsoluteCoords', () => {
    const testCases = [
      {
        name: 'should calculate absolute coordinates at origin',
        input: [0, 0, 10, 10, 0, 0, 10, 10] as const,
        expected: { x: 0, y: 0 },
      },
      {
        name: 'should calculate absolute coordinates at midpoint',
        input: [0, 0, 10, 10, 0.5, 0.5, 10, 10] as const,
        expected: { x: 5, y: 5 },
      },
      {
        name: 'should calculate absolute coordinates at end point',
        input: [0, 0, 10, 10, 1, 1, 10, 10] as const,
        expected: { x: 10, y: 10 },
      },
      {
        name: 'should handle negative deltas',
        input: [10, 10, 0, 0, 0.5, 0.5, -10, -10] as const,
        expected: { x: 5, y: 5 },
      },
      {
        name: 'should handle horizontal line',
        input: [0, 5, 10, 5, 0.5, 0, 10, 0] as const,
        expected: { x: 5, y: 5 },
      },
      {
        name: 'should handle vertical line',
        input: [5, 0, 5, 10, 0, 0.5, 0, 10] as const,
        expected: { x: 5, y: 5 },
      },
      {
        name: 'should handle zero valueX and valueY',
        input: [10, 20, 30, 40, 0, 0, 20, 20] as const,
        expected: { x: 10, y: 20 },
      },
    ];

    testCases.forEach(({ name, input, expected }) => {
      it(name, () => {
        const [x1, y1, x2, y2, valueX, valueY, deltaX, deltaY] = input;
        expect(calculateAbsoluteCoords(x1, y1, x2, y2, valueX, valueY, deltaX, deltaY)).toEqual(expected);
      });
    });
  });

  describe('calculateAngle', () => {
    const testCases = [
      {
        name: 'should calculate angle for horizontal right (0 degrees)',
        input: [0, 0, 10, 0] as const,
        expected: 0,
      },
      {
        name: 'should calculate angle for vertical down (90 degrees)',
        input: [0, 0, 0, 10] as const,
        expected: Math.PI / 2,
      },
      {
        name: 'should calculate angle for horizontal left (180 degrees)',
        input: [0, 0, -10, 0] as const,
        expected: Math.PI,
      },
      {
        name: 'should calculate angle for vertical up (-90 degrees)',
        input: [0, 0, 0, -10] as const,
        expected: -Math.PI / 2,
      },
      {
        name: 'should calculate angle for 45 degrees diagonal',
        input: [0, 0, 10, 10] as const,
        expected: Math.PI / 4,
      },
      {
        name: 'should calculate angle for 135 degrees diagonal',
        input: [0, 0, -10, 10] as const,
        expected: (3 * Math.PI) / 4,
      },
      {
        name: 'should handle same point (undefined angle)',
        input: [5, 5, 5, 5] as const,
        expected: 0,
      },
      {
        name: 'should handle negative starting coordinates',
        input: [-5, -5, 5, 5] as const,
        expected: Math.PI / 4,
      },
    ];

    testCases.forEach(({ name, input, expected }) => {
      it(name, () => {
        const [x1, y1, x2, y2] = input;
        const result = calculateAngle(x1, y1, x2, y2);
        expect(result).toBeCloseTo(expected, 10);
      });
    });
  });

  describe('calculateDistance', () => {
    const testCases = [
      {
        name: 'should calculate distance for horizontal line',
        input: [0, 0, 10, 0] as const,
        expected: 10,
      },
      {
        name: 'should calculate distance for vertical line',
        input: [0, 0, 0, 10] as const,
        expected: 10,
      },
      {
        name: 'should calculate distance for diagonal (3-4-5 triangle)',
        input: [0, 0, 3, 4] as const,
        expected: 5,
      },
      {
        name: 'should calculate distance for diagonal (5-12-13 triangle)',
        input: [0, 0, 5, 12] as const,
        expected: 13,
      },
      {
        name: 'should handle negative coordinates',
        input: [-3, -4, 0, 0] as const,
        expected: 5,
      },
      {
        name: 'should handle zero distance (same point)',
        input: [5, 5, 5, 5] as const,
        expected: 0,
      },
      {
        name: 'should handle floating point coordinates',
        input: [0, 0, 1.5, 2] as const,
        expected: 2.5,
      },
      {
        name: 'should calculate distance across quadrants',
        input: [-5, -5, 5, 5] as const,
        expected: Math.sqrt(200),
      },
      {
        name: 'should calculate unit distance',
        input: [0, 0, 1, 0] as const,
        expected: 1,
      },
    ];

    testCases.forEach(({ name, input, expected }) => {
      it(name, () => {
        const [x1, y1, x2, y2] = input;
        const result = calculateDistance(x1, y1, x2, y2);
        expect(result).toBeCloseTo(expected, 10);
      });
    });
  });
});
