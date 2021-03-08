import { last } from 'lodash';

export const GRAPHITE_VERSIONS = ['0.9', '1.0', '1.1'];

export const DEFAULT_GRAPHITE_VERSION = last(GRAPHITE_VERSIONS)!;
