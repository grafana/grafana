// Copyright (c) 2019 The Jaeger Authors.
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

import { orderTags, deduplicateTags } from './transform-trace-data';

describe('orderTags()', () => {
  it('correctly orders tags', () => {
    const orderedTags = orderTags(
      [
        { key: 'b.ip', value: '8.8.4.4' },
        { key: 'http.Status_code', value: '200' },
        { key: 'z.ip', value: '8.8.8.16' },
        { key: 'a.ip', value: '8.8.8.8' },
        { key: 'http.message', value: 'ok' },
      ],
      ['z.', 'a.', 'HTTP.']
    );
    expect(orderedTags).toEqual([
      { key: 'z.ip', value: '8.8.8.16' },
      { key: 'a.ip', value: '8.8.8.8' },
      { key: 'http.message', value: 'ok' },
      { key: 'http.Status_code', value: '200' },
      { key: 'b.ip', value: '8.8.4.4' },
    ]);
  });
});

describe('deduplicateTags()', () => {
  it('deduplicates tags', () => {
    const tagsInfo = deduplicateTags([
      { key: 'b.ip', value: '8.8.4.4' },
      { key: 'b.ip', value: '8.8.8.8' },
      { key: 'b.ip', value: '8.8.4.4' },
      { key: 'a.ip', value: '8.8.8.8' },
    ]);

    expect(tagsInfo.tags).toEqual([
      { key: 'b.ip', value: '8.8.4.4' },
      { key: 'b.ip', value: '8.8.8.8' },
      { key: 'a.ip', value: '8.8.8.8' },
    ]);
    expect(tagsInfo.warnings).toEqual(['Duplicate tag "b.ip:8.8.4.4"']);
  });
});
