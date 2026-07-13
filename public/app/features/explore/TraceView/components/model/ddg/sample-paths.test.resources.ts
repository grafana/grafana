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

const simplePayloadElemMaker = (label: string) => ({
  operation: `${label}Operation`,
  service: `${label}Service`,
});

const focalPayloadElem = simplePayloadElemMaker('focal');

const firstPayloadElem = simplePayloadElemMaker('first');
const beforePayloadElem = simplePayloadElemMaker('before');
const afterPayloadElem = simplePayloadElemMaker('after');
const lastPayloadElem = simplePayloadElemMaker('last');

export const simplePath = [firstPayloadElem, beforePayloadElem, focalPayloadElem, afterPayloadElem, lastPayloadElem];
