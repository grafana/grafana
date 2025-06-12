import { uniq } from 'lodash';

import { intrinsics } from '../traceql/traceql';

export const testIntrinsics = uniq(['duration', 'kind', 'name', 'status'].concat(intrinsics));

export const v1Tags = ['bar', 'foo'];

export const v2Tags = [
  {
    name: 'resource',
    tags: ['cluster', 'container'],
  },
  {
    name: 'span',
    tags: ['db'],
  },
  {
    name: 'intrinsic',
    tags: testIntrinsics,
  },
];

export const emptyTags = [];
