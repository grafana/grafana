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
/**
 * Which items of a {@link SpanDetail} component are expanded.
 */
export default class DetailState {
    constructor(oldState) {
        const { isTagsOpen, isProcessOpen, isReferencesOpen, isWarningsOpen, isStackTracesOpen, logs, references, } = oldState || {};
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
    toggleReferenceItem(reference) {
        const next = new DetailState(this);
        if (next.references.openedItems.has(reference)) {
            next.references.openedItems.delete(reference);
        }
        else {
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
    toggleLogItem(logItem) {
        const next = new DetailState(this);
        if (next.logs.openedItems.has(logItem)) {
            next.logs.openedItems.delete(logItem);
        }
        else {
            next.logs.openedItems.add(logItem);
        }
        return next;
    }
}
//# sourceMappingURL=DetailState.js.map