import { buildSelector, facetLabels } from './selectorBuilder';
import { METRIC_LABEL, SelectableLabel } from './types';

// Mock the dependencies
jest.mock('../../language_utils', () => ({
  escapeLabelValueInExactSelector: (value: string) => value,
  escapeLabelValueInRegexSelector: (value: string) => value,
}));

jest.mock('../../utf8_support', () => ({
  utf8Support: (value: string) => value,
  isValidLegacyName: (name: string) => /^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(name),
}));

describe('selectorBuilder', () => {
  describe('buildSelector', () => {
    it('should return empty selector when no labels are selected', () => {
      const labels: SelectableLabel[] = [];
      expect(buildSelector(labels)).toBe('{}');
    });

    it('should return empty selector when no values are selected', () => {
      const labels: SelectableLabel[] = [
        {
          name: 'job',
          selected: true,
          values: [
            { name: 'prometheus', selected: false },
            { name: 'node_exporter', selected: false },
          ],
        },
      ];
      expect(buildSelector(labels)).toBe('{}');
    });

    it('should build selector with a single metric', () => {
      const labels: SelectableLabel[] = [
        {
          name: METRIC_LABEL,
          values: [{ name: 'http_requests_total', selected: true }],
        },
      ];
      expect(buildSelector(labels)).toBe('http_requests_total{}');
    });

    it('should build selector with a single label', () => {
      const labels: SelectableLabel[] = [
        {
          name: 'job',
          selected: true,
          values: [{ name: 'prometheus', selected: true }],
        },
      ];
      expect(buildSelector(labels)).toBe('{job="prometheus"}');
    });

    it('should build selector with a metric and a label', () => {
      const labels: SelectableLabel[] = [
        {
          name: METRIC_LABEL,
          values: [{ name: 'http_requests_total', selected: true }],
        },
        {
          name: 'job',
          selected: true,
          values: [{ name: 'prometheus', selected: true }],
        },
      ];
      expect(buildSelector(labels)).toBe('http_requests_total{job="prometheus"}');
    });

    it('should build selector with multiple label values using regex', () => {
      const labels: SelectableLabel[] = [
        {
          name: 'job',
          selected: true,
          values: [
            { name: 'prometheus', selected: true },
            { name: 'node_exporter', selected: true },
          ],
        },
      ];
      expect(buildSelector(labels)).toBe('{job=~"prometheus|node_exporter"}');
    });

    it('should build selector with multiple labels', () => {
      const labels: SelectableLabel[] = [
        {
          name: METRIC_LABEL,
          values: [{ name: 'http_requests_total', selected: true }],
        },
        {
          name: 'job',
          selected: true,
          values: [{ name: 'prometheus', selected: true }],
        },
        {
          name: 'instance',
          selected: true,
          values: [{ name: 'localhost:9090', selected: true }],
        },
      ];
      expect(buildSelector(labels)).toBe('http_requests_total{job="prometheus",instance="localhost:9090"}');
    });

    it('should build selector with a mix of single and multiple values', () => {
      const labels: SelectableLabel[] = [
        {
          name: METRIC_LABEL,
          values: [{ name: 'http_requests_total', selected: true }],
        },
        {
          name: 'job',
          selected: true,
          values: [
            { name: 'prometheus', selected: true },
            { name: 'node_exporter', selected: true },
          ],
        },
        {
          name: 'instance',
          selected: true,
          values: [{ name: 'localhost:9090', selected: true }],
        },
      ];
      expect(buildSelector(labels)).toBe('http_requests_total{job=~"prometheus|node_exporter",instance="localhost:9090"}');
    });

    it('should handle non-legacy metric names with quotes', () => {
      const labels: SelectableLabel[] = [
        {
          name: METRIC_LABEL,
          values: [{ name: 'metric-with-dashes', selected: true }],
        },
      ];
      expect(buildSelector(labels)).toBe('{"metric-with-dashes"}');
    });

    it('should handle non-legacy metric names with labels', () => {
      const labels: SelectableLabel[] = [
        {
          name: METRIC_LABEL,
          values: [{ name: 'metric-with-dashes', selected: true }],
        },
        {
          name: 'job',
          selected: true,
          values: [{ name: 'prometheus', selected: true }],
        },
      ];
      expect(buildSelector(labels)).toBe('{"metric-with-dashes",job="prometheus"}');
    });

    it('should ignore unselected labels', () => {
      const labels: SelectableLabel[] = [
        {
          name: METRIC_LABEL,
          values: [{ name: 'http_requests_total', selected: true }],
        },
        {
          name: 'job',
          selected: true,
          values: [{ name: 'prometheus', selected: true }],
        },
        {
          name: 'instance',
          selected: false,
          values: [{ name: 'localhost:9090', selected: true }],
        },
      ];
      expect(buildSelector(labels)).toBe('http_requests_total{job="prometheus"}');
    });

    it('should ignore labels with no selected values', () => {
      const labels: SelectableLabel[] = [
        {
          name: METRIC_LABEL,
          values: [{ name: 'http_requests_total', selected: true }],
        },
        {
          name: 'job',
          selected: true,
          values: [{ name: 'prometheus', selected: false }],
        },
      ];
      expect(buildSelector(labels)).toBe('http_requests_total{}');
    });
  });

  describe('facetLabels', () => {
    it('should update labels with possible values', () => {
      const labels: SelectableLabel[] = [
        { name: 'job', selected: true },
        { name: 'instance', selected: false },
      ];
      
      const possibleLabels: Record<string, string[]> = {
        job: ['prometheus', 'node_exporter'],
      };
      
      const result = facetLabels(labels, possibleLabels);
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('job');
      expect(result[0].values).toHaveLength(2);
      expect(result[0].values?.[0].name).toBe('prometheus');
      expect(result[0].values?.[1].name).toBe('node_exporter');
      expect(result[0].hidden).toBe(false);
      expect(result[0].facets).toBe(2);
      
      expect(result[1].name).toBe('instance');
      expect(result[1].values).toBeUndefined();
      expect(result[1].hidden).toBe(true);
      expect(result[1].facets).toBe(0);
    });
    
    it('should preserve selected values when facetting', () => {
      const labels: SelectableLabel[] = [
        { 
          name: 'job', 
          selected: true,
          values: [
            { name: 'prometheus', selected: true },
            { name: 'grafana', selected: false },
          ],
        },
        { name: 'instance', selected: false },
      ];
      
      const possibleLabels: Record<string, string[]> = {
        job: ['prometheus', 'node_exporter'],
      };
      
      const result = facetLabels(labels, possibleLabels);
      
      expect(result[0].values).toHaveLength(2);
      expect(result[0].values?.[0].name).toBe('prometheus');
      expect(result[0].values?.[0].selected).toBe(true);
      expect(result[0].values?.[1].name).toBe('node_exporter');
      expect(result[0].values?.[1].selected).toBe(false);
    });
    
    it('should keep existing values when facetting the same label', () => {
      const labels: SelectableLabel[] = [
        { 
          name: 'job', 
          selected: true,
          values: [
            { name: 'prometheus', selected: true },
            { name: 'grafana', selected: false },
          ],
        },
      ];
      
      const possibleLabels: Record<string, string[]> = {
        job: ['prometheus', 'node_exporter'],
      };
      
      const result = facetLabels(labels, possibleLabels, 'job');
      
      expect(result[0].values).toHaveLength(2);
      expect(result[0].values?.[0].name).toBe('prometheus');
      expect(result[0].values?.[1].name).toBe('grafana');
    });
    
    it('should handle empty possible labels', () => {
      const labels: SelectableLabel[] = [
        { name: 'job', selected: true },
        { name: 'instance', selected: false },
      ];
      
      const possibleLabels: Record<string, string[]> = {};
      
      const result = facetLabels(labels, possibleLabels);
      
      expect(result).toHaveLength(2);
      expect(result[0].hidden).toBe(true);
      expect(result[0].values).toBeUndefined();
      expect(result[0].facets).toBe(0);
      
      expect(result[1].hidden).toBe(true);
      expect(result[1].values).toBeUndefined();
      expect(result[1].facets).toBe(0);
    });
  });
}); 
