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
export default class PathElem {
    constructor({ path, operation, memberIdx }) {
        this.toJSONHelper = () => ({
            memberIdx: this.memberIdx,
            operation: this.operation.name,
            service: this.operation.service.name,
            visibilityIdx: this._visibilityIdx,
        });
        this.memberIdx = memberIdx;
        this.memberOf = path;
        this.operation = operation;
    }
    get distance() {
        return this.memberIdx - this.memberOf.focalIdx;
    }
    get externalPath() {
        const result = [];
        let current = this;
        while (current) {
            result.push(current);
            current = current.externalSideNeighbor;
        }
        if (this.distance < 0) {
            result.reverse();
        }
        return result;
    }
    get externalSideNeighbor() {
        if (!this.distance) {
            return null;
        }
        return this.memberOf.members[this.memberIdx + Math.sign(this.distance)];
    }
    get focalPath() {
        const result = [];
        let current = this;
        while (current) {
            result.push(current);
            current = current.focalSideNeighbor;
        }
        if (this.distance > 0) {
            result.reverse();
        }
        return result;
    }
    get focalSideNeighbor() {
        if (!this.distance) {
            return null;
        }
        return this.memberOf.members[this.memberIdx - Math.sign(this.distance)];
    }
    get isExternal() {
        return Boolean(this.distance) && (this.memberIdx === 0 || this.memberIdx === this.memberOf.members.length - 1);
    }
    set visibilityIdx(visibilityIdx) {
        if (this._visibilityIdx == null) {
            this._visibilityIdx = visibilityIdx;
        }
        else {
            throw new Error('Visibility Index cannot be changed once set');
        }
    }
    get visibilityIdx() {
        if (this._visibilityIdx == null) {
            throw new Error('Visibility Index was never set for this PathElem');
        }
        return this._visibilityIdx;
    }
    /*
     * Because the memberOf on a PathElem contains an array of all of its members which in turn all contain
     * memberOf back to the path, some assistance is necessary when creating error messages. toJSON is called by
     * JSON.stringify and expected to return a JSON object. To that end, this method simplifies the
     * representation of the PathElems in memberOf's path to remove the circular reference.
     */
    toJSON() {
        return Object.assign(Object.assign({}, this.toJSONHelper()), { memberOf: {
                focalIdx: this.memberOf.focalIdx,
                members: this.memberOf.members.map((member) => member.toJSONHelper()),
            } });
    }
    // `toJSON` is called by `JSON.stringify` while `toString` is used by template strings and string concat
    toString() {
        return JSON.stringify(this.toJSON(), null, 2);
    }
    // `[Symbol.toStringTag]` is used when attempting to use an object as a key on an object, where a full
    // stringified JSON would reduce clarity
    get [Symbol.toStringTag]() {
        return `PathElem ${this._visibilityIdx}`;
    }
}
//# sourceMappingURL=PathElem.js.map