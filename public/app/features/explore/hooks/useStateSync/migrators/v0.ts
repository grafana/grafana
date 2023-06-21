import { ExploreUrlState } from '@grafana/data';
import { safeParseJson } from 'app/core/utils/explore';
import { DEFAULT_RANGE } from 'app/features/explore/state/utils';

import { BaseExploreURL, MigrationHandler } from './types';

export interface ExploreURLV0 extends BaseExploreURL {
  schemaVersion: 0;
  left: ExploreUrlState;
  right?: ExploreUrlState;
}

export const v0Migrator: MigrationHandler<never, ExploreURLV0> = {
  parse: (params) => {
    return {
      schemaVersion: 0,
      left: parseUrlState(typeof params.left === 'string' ? params.left : undefined),
      ...(params.right && {
        right: parseUrlState(typeof params.right === 'string' ? params.right : undefined),
      }),
    };
  },
};

const isSegment = (segment: { [key: string]: string }, ...props: string[]) =>
  props.some((prop) => segment.hasOwnProperty(prop));

enum ParseUrlStateIndex {
  RangeFrom = 0,
  RangeTo = 1,
  Datasource = 2,
  SegmentsStart = 3,
}

function parseUrlState(initial: string | undefined): ExploreUrlState {
  const parsed = safeParseJson(initial);
  const errorResult = {
    datasource: null,
    queries: [],
    range: DEFAULT_RANGE,
  };

  if (!parsed) {
    return errorResult;
  }

  if (!Array.isArray(parsed)) {
    return { queries: [], range: DEFAULT_RANGE, ...parsed };
  }

  if (parsed.length <= ParseUrlStateIndex.SegmentsStart) {
    console.error('Error parsing compact URL state for Explore.');
    return errorResult;
  }

  const range = {
    from: parsed[ParseUrlStateIndex.RangeFrom],
    to: parsed[ParseUrlStateIndex.RangeTo],
  };
  const datasource = parsed[ParseUrlStateIndex.Datasource];
  const parsedSegments = parsed.slice(ParseUrlStateIndex.SegmentsStart);
  const queries = parsedSegments.filter((segment) => !isSegment(segment, 'ui', 'mode', '__panelsState'));

  const panelsState = parsedSegments.find((segment) => isSegment(segment, '__panelsState'))?.__panelsState;
  return { datasource, queries, range, panelsState };
}
