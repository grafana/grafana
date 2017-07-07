import {describe, beforeEach, it, sinon, expect} from 'test/lib/common'

import flatten from 'app/core/utils/flatten';

describe("flatten", () => {

  it('should return flatten object', () => {
    var flattened = flatten({
      level1: 'level1-value',
      deeper: {
        level2: 'level2-value',
        deeper: {
          level3: 'level3-value'
        }
      }
    }, null);

    expect(flattened['level1']).to.be('level1-value');
    expect(flattened['deeper.level2']).to.be('level2-value');
    expect(flattened['deeper.deeper.level3']).to.be('level3-value');
  });

});

