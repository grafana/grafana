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

export function localeStringComparator(itemA: string, itemB: string) {
  return itemA.localeCompare(itemB);
}

export function classNameForSortDir(dir: number) {
  return `sorted ${dir === 1 ? 'ascending' : 'descending'}`;
}

export function getNewSortForClick(
  prevSort: { key: string; dir: number },
  column: { name: string; defaultDir?: number }
) {
  const { defaultDir = 1 } = column;

  return {
    key: column.name,
    dir: prevSort.key === column.name ? -1 * prevSort.dir : defaultDir,
  };
}
