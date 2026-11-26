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

import type TNil from '../types/TNil';
import { type TraceSpan } from '../types/trace';

/**
 * Returns the span above the given one in the span tree.
 *
 * A span below the top level sits under the target of its first reference. Top level spans can have references too,
 * such as links to their own descendants, so references alone don't describe the tree.
 */
export function getTreeParent(span: TraceSpan): TraceSpan | TNil {
  return span.depth > 0 ? span.references?.[0]?.span : undefined;
}

export default function spanAncestorIds(span: TraceSpan | TNil): string[] {
  const ancestorIDs: string[] = [];
  let parent = span ? getTreeParent(span) : undefined;
  while (parent) {
    ancestorIDs.push(parent.spanID);
    parent = getTreeParent(parent);
  }
  return ancestorIDs;
}
