// Copyright (c) 2017 Uber Technologies, Inc.
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

import { TraceLog, TraceSpanReference } from '../../types/trace';

/**
 * Which items of a {@link SpanDetail} component are expanded.
 */
export default class DetailState {
  isTagsOpen: boolean;
  isProcessOpen: boolean;
  logs: { isOpen: boolean; openedItems: Set<TraceLog> };
  references: { isOpen: boolean; openedItems: Set<TraceSpanReference> };
  isWarningsOpen: boolean;
  isStackTracesOpen: boolean;
  isReferencesOpen: boolean;

  constructor(oldState?: DetailState) {
    const {
      isTagsOpen,
      isProcessOpen,
      isReferencesOpen,
      isWarningsOpen,
      isStackTracesOpen,
      logs,
      references,
    }: DetailState | Record<string, undefined> = oldState || {};
    this.isTagsOpen = Boolean(isTagsOpen);
    this.isProcessOpen = Boolean(isProcessOpen);
    this.isReferencesOpen = Boolean(isReferencesOpen);
    this.isWarningsOpen = Boolean(isWarningsOpen);
    this.isStackTracesOpen = Boolean(isStackTracesOpen);
    this.logs = {
      isOpen: Boolean(logs && logs.isOpen),
      openedItems: logs && logs.openedItems ? new Set(logs.openedItems) : new Set(),
    };
    this.references = {
      isOpen: Boolean(references && references.isOpen),
      openedItems: references && references.openedItems ? new Set(references.openedItems) : new Set(),
    };
  }

  toggleTags() {
    const next = new DetailState(this);
    next.isTagsOpen = !this.isTagsOpen;
    return next;
  }

  toggleProcess() {
    const next = new DetailState(this);
    next.isProcessOpen = !this.isProcessOpen;
    return next;
  }

  toggleReferences() {
    const next = new DetailState(this);
    next.references.isOpen = !this.references.isOpen;
    return next;
  }

  toggleReferenceItem(reference: TraceSpanReference) {
    const next = new DetailState(this);
    if (next.references.openedItems.has(reference)) {
      next.references.openedItems.delete(reference);
    } else {
      next.references.openedItems.add(reference);
    }
    return next;
  }

  toggleWarnings() {
    const next = new DetailState(this);
    next.isWarningsOpen = !this.isWarningsOpen;
    return next;
  }

  toggleStackTraces() {
    const next = new DetailState(this);
    next.isStackTracesOpen = !this.isStackTracesOpen;
    return next;
  }

  toggleLogs() {
    const next = new DetailState(this);
    next.logs.isOpen = !this.logs.isOpen;
    return next;
  }

  toggleLogItem(logItem: TraceLog) {
    const next = new DetailState(this);
    if (next.logs.openedItems.has(logItem)) {
      next.logs.openedItems.delete(logItem);
    } else {
      next.logs.openedItems.add(logItem);
    }
    return next;
  }
}
