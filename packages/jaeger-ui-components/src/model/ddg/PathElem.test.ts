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

import PathElem from './PathElem';
import { simplePath } from './sample-paths.test.resources';
import { TDdgOperation, TDdgPath, TDdgService } from './types';

describe('PathElem', () => {
  const getPath = () => {
    const path = {
      focalIdx: 2,
    } as TDdgPath;
    const members = simplePath.map(
      ({ operation, service }, i) =>
        new PathElem({
          memberIdx: i,
          operation: {
            name: operation,
            service: {
              name: service,
            } as TDdgService,
          } as TDdgOperation,
          path,
        })
    );
    members[2].visibilityIdx = 0;
    members[3].visibilityIdx = 1;
    members[1].visibilityIdx = 2;
    members[4].visibilityIdx = 3;
    members[0].visibilityIdx = 4;
    path.members = members;
    return path;
  };
  const testMemberIdx = 3;
  const testOperation = {} as TDdgOperation;
  const testPath = {
    focalIdx: 4,
    members: ['member0', 'member1', 'member2', 'member3', 'member4', 'member5'],
  } as unknown as TDdgPath;
  const testVisibilityIdx = 105;
  let pathElem: PathElem;

  beforeEach(() => {
    pathElem = new PathElem({ path: testPath, operation: testOperation, memberIdx: testMemberIdx });
  });

  it('initializes instance properties', () => {
    expect(pathElem.memberIdx).toBe(testMemberIdx);
    expect(pathElem.memberOf).toBe(testPath);
    expect(pathElem.operation).toBe(testOperation);
  });

  it('calculates distance', () => {
    expect(pathElem.distance).toBe(-1);
  });

  it('sets visibilityIdx', () => {
    pathElem.visibilityIdx = testVisibilityIdx;
    expect(pathElem.visibilityIdx).toBe(testVisibilityIdx);
  });

  it('errors when trying to access unset visibilityIdx', () => {
    expect(() => pathElem.visibilityIdx).toThrowError();
  });

  it('errors when trying to override visibilityIdx', () => {
    pathElem.visibilityIdx = testVisibilityIdx;
    expect(() => {
      pathElem.visibilityIdx = testVisibilityIdx;
    }).toThrowError();
  });

  it('has externalSideNeighbor if distance is not 0 and it is not external', () => {
    expect(pathElem.externalSideNeighbor).toBe(testPath.members[testMemberIdx - 1]);
  });

  it('has a null externalSideNeighbor if distance is 0', () => {
    pathElem = new PathElem({ path: testPath, operation: testOperation, memberIdx: testPath.focalIdx });
    expect(pathElem.externalSideNeighbor).toBe(null);
  });

  it('has an undefined externalSideNeighbor if is external', () => {
    pathElem = new PathElem({ path: testPath, operation: testOperation, memberIdx: 0 });
    expect(pathElem.externalSideNeighbor).toBe(undefined);
  });

  it('has focalSideNeighbor if distance is not 0', () => {
    expect(pathElem.focalSideNeighbor).toBe(testPath.members[testMemberIdx + 1]);
  });

  it('has a null focalSideNeighbor if distance is 0', () => {
    pathElem = new PathElem({ path: testPath, operation: testOperation, memberIdx: testPath.focalIdx });
    expect(pathElem.focalSideNeighbor).toBe(null);
  });

  it('is external if it is first or last PathElem in memberOf.path and not the focalElem', () => {
    expect(pathElem.isExternal).toBe(false);

    const firstElem = new PathElem({ path: testPath, operation: testOperation, memberIdx: 0 });
    expect(firstElem.isExternal).toBe(true);

    const lastElem = new PathElem({
      path: testPath,
      operation: testOperation,
      memberIdx: testPath.members.length - 1,
    });
    expect(lastElem.isExternal).toBe(true);

    const path = {
      ...testPath,
      focalIdx: testPath.members.length - 1,
    };
    const focalElem = new PathElem({ path, operation: testOperation, memberIdx: path.members.length - 1 });
    expect(focalElem.isExternal).toBe(false);
  });

  describe('externalPath', () => {
    const path = getPath();

    it('returns array of itself if it is focal elem', () => {
      const targetPathElem = path.members[path.focalIdx];
      expect(targetPathElem.externalPath).toEqual([targetPathElem]);
    });

    it('returns path away from focal elem in correct order for upstream elem', () => {
      const idx = path.focalIdx - 1;
      const targetPathElem = path.members[idx];
      expect(targetPathElem.externalPath).toEqual(path.members.slice(0, idx + 1));
    });

    it('returns path away from focal elem in correct order for downstream elem', () => {
      const idx = path.focalIdx + 1;
      const targetPathElem = path.members[idx];
      expect(targetPathElem.externalPath).toEqual(path.members.slice(idx));
    });
  });

  describe('focalPath', () => {
    const path = getPath();

    it('returns array of itself if it is focal elem', () => {
      const targetPathElem = path.members[path.focalIdx];
      expect(targetPathElem.focalPath).toEqual([targetPathElem]);
    });

    it('returns path to focal elem in correct order for upstream elem', () => {
      const targetPathElem = path.members[0];
      expect(targetPathElem.focalPath).toEqual(path.members.slice(0, path.focalIdx + 1));
    });

    it('returns path to focal elem in correct order for downstream elem', () => {
      const idx = path.members.length - 1;
      const targetPathElem = path.members[idx];
      expect(targetPathElem.focalPath).toEqual(path.members.slice(path.focalIdx, idx + 1));
    });
  });

  describe('legibility', () => {
    const path = getPath();
    const targetPathElem = path.members[1];

    it('creates consumable JSON', () => {
      expect(targetPathElem.toJSON()).toMatchSnapshot();
    });

    it('creates consumable string', () => {
      expect(targetPathElem.toString()).toBe(JSON.stringify(targetPathElem.toJSON(), null, 2));
    });

    it('creates informative string tag', () => {
      expect(Object.prototype.toString.call(targetPathElem)).toEqual(
        `[object PathElem ${targetPathElem.visibilityIdx}]`
      );
    });
  });
});
