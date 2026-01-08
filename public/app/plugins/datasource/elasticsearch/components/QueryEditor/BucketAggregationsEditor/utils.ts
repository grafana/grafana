import { InternalTimeZones, SelectableValue } from '@grafana/data';

import { defaultGeoHashPrecisionString } from '../../../queryDef';
import { BucketsConfiguration } from '../../../types';

import { defaultFilter } from './SettingsEditor/FiltersSettingsEditor/utils';

export const bucketAggregationConfig: BucketsConfiguration = {
  terms: {
    label: 'Terms',
    requiresField: true,
    defaultSettings: {
      min_doc_count: '1',
      size: '10',
      order: 'desc',
      orderBy: '_term',
    },
  },
  filters: {
    label: 'Filters',
    requiresField: false,
    defaultSettings: {
      filters: [defaultFilter()],
    },
  },
  geohash_grid: {
    label: 'Geo Hash Grid',
    requiresField: true,
    defaultSettings: {
      precision: defaultGeoHashPrecisionString,
    },
  },
  date_histogram: {
    label: 'Date Histogram',
    requiresField: true,
    defaultSettings: {
      interval: 'auto',
      min_doc_count: '0',
      trimEdges: '0',
      timeZone: InternalTimeZones.utc,
    },
  },
  histogram: {
    label: 'Histogram',
    requiresField: true,
    defaultSettings: {
      interval: '1000',
      min_doc_count: '0',
    },
  },
  nested: {
    label: 'Nested (experimental)',
    requiresField: true,
    defaultSettings: {},
  },
};

export const orderByOptions: Array<SelectableValue<string>> = [
  { label: 'Term value', value: '_term' },
  { label: 'Doc Count', value: '_count' },
];

export const orderOptions: Array<SelectableValue<string>> = [
  { label: 'Top', value: 'desc' },
  { label: 'Bottom', value: 'asc' },
];
