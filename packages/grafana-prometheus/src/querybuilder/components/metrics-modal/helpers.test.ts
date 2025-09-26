import { PrometheusLanguageProviderInterface } from '../../../language_provider';
import { PromMetricsMetadata } from '../../../types';

import { calculatePageList, generateMetricData, getPlaceholders, getPromTypes } from './helpers';
import { MetricsData } from './types';

// Mock the language provider
const createMockLanguageProvider = (metadata: PromMetricsMetadata = {}): PrometheusLanguageProviderInterface =>
  ({
    retrieveMetricsMetadata: jest.fn().mockReturnValue(metadata),
  }) as unknown as PrometheusLanguageProviderInterface;

describe('helpers.ts', () => {
  describe('generateMetricData', () => {
    it('should generate basic metric data', () => {
      const mockProvider = createMockLanguageProvider({
        test_metric: {
          type: 'counter',
          help: 'Test counter metric',
        },
      });

      const result = generateMetricData('test_metric', mockProvider);

      expect(result).toEqual({
        value: 'test_metric',
        type: 'counter',
        description: 'Test counter metric',
      });
    });

    it('should handle metric with no metadata', () => {
      const mockProvider = createMockLanguageProvider({});

      const result = generateMetricData('unknown_metric', mockProvider);

      expect(result).toEqual({
        value: 'unknown_metric',
        type: undefined,
        description: undefined,
      });
    });

    it('should enhance type based on description for histogram', () => {
      const mockProvider = createMockLanguageProvider({
        test_metric: {
          type: 'gauge',
          help: 'This is a histogram metric for testing',
        },
      });

      const result = generateMetricData('test_metric', mockProvider);

      expect(result.type).toBe('gauge (histogram)');
    });

    it('should enhance type based on description for summary', () => {
      const mockProvider = createMockLanguageProvider({
        test_metric: {
          type: 'counter',
          help: 'This is a summary metric for testing',
        },
      });

      const result = generateMetricData('test_metric', mockProvider);

      expect(result.type).toBe('counter (summary)');
    });

    it('should not enhance type if already matches description', () => {
      const mockProvider = createMockLanguageProvider({
        test_metric: {
          type: 'histogram',
          help: 'This is a histogram metric for testing',
        },
      });

      const result = generateMetricData('test_metric', mockProvider);

      expect(result.type).toBe('native histogram'); // Should be native histogram, not enhanced
    });

    it('should detect native histogram vs classic histogram', () => {
      const mockProvider = createMockLanguageProvider({
        native_histogram: {
          type: 'histogram',
          help: 'Native histogram',
        },
        classic_bucket: {
          type: 'histogram',
          help: 'Classic histogram',
        },
        classic_bucket_with_labels: {
          type: 'histogram',
          help: 'Classic histogram with labels',
        },
      });

      // Native histogram (no _bucket suffix)
      const nativeResult = generateMetricData('native_histogram', mockProvider);
      expect(nativeResult.type).toBe('native histogram');

      // Classic histogram (with _bucket suffix)
      const classicResult = generateMetricData('classic_bucket', mockProvider);
      expect(classicResult.type).toBe('histogram');

      // Classic histogram with labels
      const classicWithLabelsResult = generateMetricData('classic_bucket_with_labels', mockProvider);
      expect(classicWithLabelsResult.type).toBe('native histogram'); // No _bucket pattern match
    });

    it('should handle old histogram pattern matching', () => {
      const mockProvider = createMockLanguageProvider({
        test_bucket: { type: 'histogram', help: 'Test bucket metric' },
        'test_bucket{le="0.1"}': { type: 'histogram', help: 'Test bucket with labels' },
        test_histogram: { type: 'histogram', help: 'Test histogram metric' },
      });

      // Should be classic histogram (matches pattern)
      expect(generateMetricData('test_bucket', mockProvider).type).toBe('histogram');
      expect(generateMetricData('test_bucket{le="0.1"}', mockProvider).type).toBe('histogram');

      // Should be native histogram (doesn't match pattern)
      expect(generateMetricData('test_histogram', mockProvider).type).toBe('native histogram');
    });

    it('should handle case-insensitive description matching', () => {
      const mockProvider = createMockLanguageProvider({
        test_metric: {
          type: 'gauge',
          help: 'This is a HISTOGRAM metric for testing',
        },
      });

      const result = generateMetricData('test_metric', mockProvider);
      expect(result.type).toBe('gauge (histogram)');
    });

    it('should handle empty type with description enhancement', () => {
      const mockProvider = createMockLanguageProvider({
        test_metric: {
          type: '',
          help: 'This is a histogram metric for testing',
        },
      });

      const result = generateMetricData('test_metric', mockProvider);
      expect(result.type).toBe('native histogram');
    });

    it('should handle empty description', () => {
      const mockProvider = createMockLanguageProvider({
        test_metric: {
          type: 'gauge',
          help: '',
        },
      });

      const result = generateMetricData('test_metric', mockProvider);
      expect(result.type).toBe('gauge');
    });
  });

  describe('calculatePageList', () => {
    const createMetricsData = (length: number): MetricsData =>
      Array.from({ length }, (_, i) => ({ value: `metric_${i}` }));

    it('should return empty array for empty metrics data', () => {
      expect(calculatePageList([], 10)).toEqual([]);
    });

    it('should return [1] for zero or negative results per page', () => {
      const metricsData = createMetricsData(5);
      expect(calculatePageList(metricsData, 0)).toEqual([1]);
      expect(calculatePageList(metricsData, -5)).toEqual([1]);
    });

    it('should calculate correct page list for exact division', () => {
      const metricsData = createMetricsData(20);
      const result = calculatePageList(metricsData, 10);
      expect(result).toEqual([1, 2]);
    });

    it('should calculate correct page list for non-exact division', () => {
      const metricsData = createMetricsData(23);
      const result = calculatePageList(metricsData, 10);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle single page scenario', () => {
      const metricsData = createMetricsData(5);
      const result = calculatePageList(metricsData, 10);
      expect(result).toEqual([1]);
    });

    it('should handle very large datasets', () => {
      const metricsData = createMetricsData(1000);
      const result = calculatePageList(metricsData, 25);
      expect(result).toHaveLength(40);
      expect(result[0]).toBe(1);
      expect(result[result.length - 1]).toBe(40);
    });

    it('should handle single item per page', () => {
      const metricsData = createMetricsData(3);
      const result = calculatePageList(metricsData, 1);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle fractional results per page', () => {
      const metricsData = createMetricsData(10);
      expect(calculatePageList(metricsData, 3.5)).toEqual([1, 2, 3]);
    });
  });

  describe('getPromTypes', () => {
    it('should return array of Prometheus types', () => {
      const types = getPromTypes();

      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBe(7);

      const expectedValues = ['counter', 'gauge', 'histogram', 'native histogram', 'summary', 'unknown', 'no type'];
      const actualValues = types.map((type) => type.value);

      expect(actualValues).toEqual(expectedValues);
    });

    it('should have correct structure for each type', () => {
      const types = getPromTypes();

      types.forEach((type) => {
        expect(type).toHaveProperty('value');
        expect(type).toHaveProperty('label');
        expect(type).toHaveProperty('description');

        expect(typeof type.value).toBe('string');
        expect(typeof type.label).toBe('string');
        expect(typeof type.description).toBe('string');

        expect(type.value.length).toBeGreaterThan(0);
        expect(type.label.length).toBeGreaterThan(0);
        expect(type.description.length).toBeGreaterThan(0);
      });
    });

    it('should return consistent results on multiple calls', () => {
      const types1 = getPromTypes();
      const types2 = getPromTypes();

      expect(types1).toEqual(types2);
    });

    it('should have unique values', () => {
      const types = getPromTypes();
      const values = types.map((type) => type.value);
      const uniqueValues = [...new Set(values)];

      expect(values.length).toBe(uniqueValues.length);
    });

    it('should have descriptive labels', () => {
      const types = getPromTypes();

      types.forEach((type) => {
        expect(type.label).not.toBe(type.value);
        expect(type.label.length).toBeGreaterThanOrEqual(type.value.length);
      });
    });
  });

  describe('getPlaceholders', () => {
    it('should return object with all required placeholders', () => {
      const placeholders = getPlaceholders();

      const expectedKeys = ['browse', 'filterType'];

      expect(Object.keys(placeholders)).toEqual(expectedKeys);
    });

    it('should have string values for all placeholders', () => {
      const placeholders = getPlaceholders();

      Object.values(placeholders).forEach((placeholder) => {
        expect(typeof placeholder).toBe('string');
        expect(placeholder.length).toBeGreaterThan(0);
      });
    });

    it('should return consistent results on multiple calls', () => {
      const placeholders1 = getPlaceholders();
      const placeholders2 = getPlaceholders();

      expect(placeholders1).toEqual(placeholders2);
    });

    it('should contain expected placeholder content', () => {
      const placeholders = getPlaceholders();

      expect(placeholders.browse).toMatch(/search/i);
      expect(placeholders.filterType).toMatch(/type/i);
    });

    it('should have descriptive placeholder text', () => {
      const placeholders = getPlaceholders();

      Object.values(placeholders).forEach((placeholder) => {
        expect(placeholder.length).toBeGreaterThan(5);
        expect(placeholder).toMatch(/[a-zA-Z]/);
      });
    });
  });
});
