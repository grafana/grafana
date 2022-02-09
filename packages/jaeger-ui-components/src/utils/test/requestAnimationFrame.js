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

const DEFAULT_ELAPSE = 0;

export default function requestAnimationFrame(callback) {
  return setTimeout(callback, DEFAULT_ELAPSE);
}

export function cancelAnimationFrame(id) {
  return clearTimeout(id);
}

export function polyfill(target, msElapse = DEFAULT_ELAPSE) {
  const _target = target || global;
  if (!_target.requestAnimationFrame) {
    if (msElapse === DEFAULT_ELAPSE) {
      // eslint-disable-next-line no-param-reassign
      _target.requestAnimationFrame = requestAnimationFrame;
    } else {
      // eslint-disable-next-line no-param-reassign, no-shadow
      _target.requestAnimationFrame = (callback) => setTimeout(callback, msElapse);
    }
  }
  if (!_target.cancelAnimationFrame) {
    // eslint-disable-next-line no-param-reassign
    _target.cancelAnimationFrame = cancelAnimationFrame;
  }
}
