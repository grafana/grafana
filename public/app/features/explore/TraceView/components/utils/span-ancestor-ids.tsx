// Copyright (c) 2019 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { find as _find, get as _get } from 'lodash';

import type TNil from '../types/TNil';
import { type TraceSpan } from '../types/trace';

function getFirstAncestor(span: TraceSpan): TraceSpan | TNil {
  return _get(
    _find(
      span.references,
      ({ span: ref, refType }) => ref && ref.spanID && (refType === 'CHILD_OF' || refType === 'FOLLOWS_FROM')
    ),
    'span'
  );
}

export default function spanAncestorIds(span: TraceSpan | TNil): string[] {
  const ancestorIDs: string[] = [];
  if (!span) {
    return ancestorIDs;
  }
  if (span.ancestorSpanIds) {
    // Callers modify the result, so it can't be the array stored on the span.
    return [...span.ancestorSpanIds];
  }
  // References can form a cycle, so each span is visited at most once.
  const visited = new Set([span.spanID]);
  let ref = getFirstAncestor(span);
  while (ref && !visited.has(ref.spanID)) {
    visited.add(ref.spanID);
    ancestorIDs.push(ref.spanID);
    ref = getFirstAncestor(ref);
  }
  return ancestorIDs;
}
