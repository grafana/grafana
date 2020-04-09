// Copyright (c) 2017 The Jaeger Authors.
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

import { Span } from '../types/trace';

/**
 * Searches the span.references to find 'CHILD_OF' reference type or returns null.
 * @param  {Span} span The span whose parent is to be returned.
 * @return {Span|null} The parent span if there is one, null otherwise.
 */
export function getParent(span: Span) {
  const parentRef = span.references ? span.references.find(ref => ref.refType === 'CHILD_OF') : null;
  return parentRef ? parentRef.span : null;
}
