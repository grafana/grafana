import { AGGREGATIONS, SYSTEM_LABELS } from './constants';
import {
  extractServicesFromMetricDescriptors,
  getAggregationOptionsByMetric,
  getAlignmentOptionsByMetric,
  getAlignmentPickerData,
  getLabelKeys,
  getMetricTypes,
  getMetricTypesByService,
  labelsToGroupedOptions,
  stringArrayToFilters,
  alignmentPeriodLabel,
  getMetricType,
  setMetricType,
} from './functions';
import { newMockDatasource } from './specs/testData';
import { AlignmentTypes, MetricDescriptor, MetricKind, TimeSeriesList, ValueTypes } from './types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    replace: jest.fn().mockImplementation((s: string) => s),
  }),
}));

describe('functions', () => {
  describe('extractServicesFromMetricDescriptors', () => {
    it('should return unique metric descriptors', () => {
      const desc: MetricDescriptor = {
        valueType: '',
        metricKind: MetricKind.CUMULATIVE,
        type: '',
        unit: '',
        service: '1',
        serviceShortName: '',
        displayName: '',
        description: '',
      };
      expect(extractServicesFromMetricDescriptors([desc, desc])).toEqual([desc]);
    });
  });

  describe('getMetricTypesByService', () => {
    it('filters by metric descriptiors', () => {
      const desc1: MetricDescriptor = {
        valueType: '',
        metricKind: MetricKind.CUMULATIVE,
        type: '',
        unit: '',
        service: '1',
        serviceShortName: '',
        displayName: '',
        description: '',
      };
      const desc2: MetricDescriptor = {
        valueType: '',
        metricKind: MetricKind.CUMULATIVE,
        type: '',
        unit: '',
        service: '2',
        serviceShortName: '',
        displayName: '',
        description: '',
      };
      expect(getMetricTypesByService([desc1, desc2], '1')).toEqual([desc1]);
    });
  });

  describe('getMetricTypes', () => {
    it('gets metric type that exists in the array', () => {
      const desc1: MetricDescriptor = {
        valueType: '',
        metricKind: MetricKind.CUMULATIVE,
        type: '1',
        unit: '',
        service: 'svc1',
        serviceShortName: '',
        displayName: 'uno',
        description: '',
      };
      const desc2: MetricDescriptor = {
        valueType: '',
        metricKind: MetricKind.CUMULATIVE,
        type: '2',
        unit: '',
        service: 'svc2',
        serviceShortName: '',
        displayName: 'dos',
        description: '',
      };
      expect(getMetricTypes([desc1, desc2], '1', '1', 'svc1')).toEqual({
        metricTypes: [{ name: 'uno', value: '1' }],
        selectedMetricType: '1',
      });
    });

    it('gets metric type that does not exist in the array', () => {
      const desc1: MetricDescriptor = {
        valueType: '',
        metricKind: MetricKind.CUMULATIVE,
        type: '1',
        unit: '',
        service: 'svc1',
        serviceShortName: '',
        displayName: 'uno',
        description: '',
      };
      const desc2: MetricDescriptor = {
        valueType: '',
        metricKind: MetricKind.CUMULATIVE,
        type: '2',
        unit: '',
        service: 'svc2',
        serviceShortName: '',
        displayName: 'dos',
        description: '',
      };
      expect(getMetricTypes([desc1, desc2], '3', '4', 'svc1')).toEqual({
        metricTypes: [{ name: 'uno', value: '1' }],
        selectedMetricType: '1',
      });
    });
  });

  describe('getAlignmentOptionsByMetric', () => {
    let result: ReturnType<typeof getAlignmentOptionsByMetric>;
    describe('when double and gauge is passed', () => {
      beforeEach(() => {
        result = getAlignmentOptionsByMetric(ValueTypes.DOUBLE, MetricKind.GAUGE);
      });

      it('should return all alignment options except two', () => {
        expect(result.length).toBe(10);
        expect(result.map((o) => o.value)).toEqual(
          expect.not.arrayContaining(['REDUCE_COUNT_TRUE', 'REDUCE_COUNT_FALSE'])
        );
      });
    });

    describe('when double and delta is passed', () => {
      beforeEach(() => {
        result = getAlignmentOptionsByMetric(ValueTypes.DOUBLE, MetricKind.DELTA);
      });

      it('should return all alignment options except four', () => {
        expect(result.length).toBe(9);
        expect(result.map((o) => o.value)).toEqual(
          expect.not.arrayContaining([
            'ALIGN_COUNT_TRUE',
            'ALIGN_COUNT_FALSE',
            'ALIGN_FRACTION_TRUE',
            'ALIGN_INTERPOLATE',
          ])
        );
      });
    });
  });

  describe('getAggregationOptionsByMetric', () => {
    it('gets a result for a type and a metric kind', () => {
      expect(getAggregationOptionsByMetric(ValueTypes.BOOL, MetricKind.CUMULATIVE)).toEqual([
        AGGREGATIONS[0],
        AGGREGATIONS[6],
      ]);
    });
  });

  describe('getLabelKeys', () => {
    it('should return labels', async () => {
      const ds = newMockDatasource();
      ds.getLabels = jest.fn().mockResolvedValue({ l1: true, l2: true });
      expect(await getLabelKeys(ds, 'type', 'project')).toEqual(['l1', 'l2', ...SYSTEM_LABELS]);
    });
  });

  describe('getAlignmentPickerData', () => {
    it('should return default data', () => {
      const res = getAlignmentPickerData();
      expect(res.alignOptions).toHaveLength(10);
      expect(res.perSeriesAligner).toEqual(AlignmentTypes.ALIGN_MEAN);
    });

    it('should use provided data', () => {
      const res = getAlignmentPickerData(ValueTypes.BOOL, MetricKind.CUMULATIVE);
      expect(res.alignOptions).toHaveLength(0);
      expect(res.perSeriesAligner).toEqual(AlignmentTypes.ALIGN_MEAN);
    });
  });

  describe('labelsToGroupedOptions', () => {
    it('should group in the same label', () => {
      expect(labelsToGroupedOptions(['foo', 'bar'])).toEqual([
        {
          expanded: true,
          label: '',
          options: [
            { label: 'foo', value: 'foo' },
            { label: 'bar', value: 'bar' },
          ],
        },
      ]);
    });

    it('should group in different labels', () => {
      expect(labelsToGroupedOptions(['foo.bar', 'foobar'])).toEqual([
        {
          expanded: true,
          label: 'Foo Bar',
          options: [{ label: 'foo.bar', value: 'foo.bar' }],
        },
        {
          expanded: true,
          label: '',
          options: [{ label: 'foobar', value: 'foobar' }],
        },
      ]);
    });
  });

  describe('stringArrayToFilters', () => {
    it('chunks an array', () => {
      expect(stringArrayToFilters(['key', 'operator', 'value', 'condition'])).toEqual([
        {
          condition: 'condition',
          key: 'key',
          operator: 'operator',
          value: 'value',
        },
      ]);
    });
  });

  describe('alignmentPeriodLabel', () => {
    it('returns period label if alignment period and per series aligner is set', () => {
      const datasource = newMockDatasource();

      const label = alignmentPeriodLabel({ perSeriesAligner: 'ALIGN_DELTA', alignmentPeriod: '10' }, datasource);
      expect(label).toBe('10s interval (delta)');
    });
  });

  describe('getMetricType', () => {
    it('returns metric type', () => {
      const metricType = getMetricType({ filters: ['metric.type', '=', 'test'] } as TimeSeriesList);
      expect(metricType).toBe('test');
    });
  });

  describe('setMetricType', () => {
    it('sets a metric type if the filter did not exist', () => {
      const metricType = setMetricType({} as TimeSeriesList, 'test');
      expect(metricType.filters).toEqual(['metric.type', '=', 'test']);
    });

    it('sets a metric type if the filter exists', () => {
      const metricType = setMetricType({ filters: ['metric.type', '=', 'test'] } as TimeSeriesList, 'other');
      expect(metricType.filters).toEqual(['metric.type', '=', 'other']);
    });
  });
});
