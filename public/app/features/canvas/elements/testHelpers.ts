import { ConnectionDirection } from '@grafana/schema';

import { type DimensionContext } from '../../dimensions/context';
import { type DimensionSupplier } from '../../dimensions/types';

/** Values each dimension getter resolves to. Override per-test to exercise a branch. */
export interface MockDimensionValues {
  color: string;
  text: string;
  scalar: number;
  scale: number;
  resource: string;
  direction: ConnectionDirection;
}

const defaultValues: MockDimensionValues = {
  color: '#ffffff',
  text: 'hello',
  scalar: 1,
  scale: 1,
  resource: 'img.svg',
  direction: ConnectionDirection.Forward,
};

function makeSupplier<T>(value: T): DimensionSupplier<T> {
  return { value: () => value, get: () => value };
}

/**
 * Builds a fake `DimensionContext` whose getters are jest mocks returning fixed-value suppliers.
 * Element `prepareData` functions only ever call `.value()`, so a single resolved value per
 * dimension is enough; the mocks also let tests assert which getters were invoked.
 */
export function createMockDimensionContext(overrides: Partial<MockDimensionValues> = {}): DimensionContext {
  const values = { ...defaultValues, ...overrides };

  return {
    // Echo the configured fixed color so tests can distinguish text/background/border colors.
    getColor: jest.fn((config) => makeSupplier(config?.fixed ?? values.color)),
    getScale: jest.fn(() => makeSupplier(values.scale)),
    getScalar: jest.fn(() => makeSupplier(values.scalar)),
    getText: jest.fn(() => makeSupplier(values.text)),
    getResource: jest.fn(() => makeSupplier(values.resource)),
    getDirection: jest.fn(() => makeSupplier(values.direction)),
    getPanelData: jest.fn(() => undefined),
  };
}
