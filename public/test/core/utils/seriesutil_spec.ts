import {describe, beforeEach, it, sinon, expect} from 'test/lib/common'

import * as seriesUtil from 'app/core/utils/seriesutil';

describe("series", () => {

  it('should return alphabet sequential letters', () => {
    var l0 = seriesUtil.seriesRefLetters(0);
    expect(l0).to.be('A');

    var l25 = seriesUtil.seriesRefLetters(25);
    expect(l25).to.be('Z');

    var l26 = seriesUtil.seriesRefLetters(26);
    expect(l26).to.be('AA');
  });

});

