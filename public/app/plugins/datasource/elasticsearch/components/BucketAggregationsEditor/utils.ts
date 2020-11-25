import { BucketsConfiguration } from '../../types';
import { defaultFilter } from './SettingsEditor/FiltersSettingsEditor/utils';

export const bucketAggregationConfig: BucketsConfiguration = {
  terms: {
    label: 'Terms',
    requiresField: true,
    defaultSettings: {
      min_doc_count: '0',
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
      precision: '3',
    },
  },
  date_histogram: {
    label: 'Date Histogram',
    requiresField: true,
    defaultSettings: {
      interval: 'auto',
      min_doc_count: '0',
      trimEdges: '0',
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
};

// TODO: Define better types for the following
export const orderOptions = [
  { label: 'Top', value: 'desc' },
  { label: 'Bottom', value: 'asc' },
];

export const sizeOptions = [
  { label: 'No limit', value: '0' },
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '5', value: '5' },
  { label: '10', value: '10' },
  { label: '15', value: '15' },
  { label: '20', value: '20' },
];

export const orderByOptions = [
  { label: 'Term value', value: '_term' },
  { label: 'Doc Count', value: '_count' },
];

export const intervalOptions = [
  { label: 'auto', value: 'auto' },
  { label: '10s', value: '10s' },
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '10m', value: '10m' },
  { label: '20m', value: '20m' },
  { label: '1h', value: '1h' },
  { label: '1d', value: '1d' },
];
