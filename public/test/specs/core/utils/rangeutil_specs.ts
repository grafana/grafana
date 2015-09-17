import {describe, beforeEach, it, sinon, expect} from 'test/lib/common'

import rangeUtil = require('app/core/utils/rangeutil')
import _  = require('lodash')
import moment  = require('moment')

describe("rangeUtil", () => {

  describe("Can get range explained", () => {

    it('should handle simple old expression with only amount and unit', () => {
      var info = rangeUtil.describeTextRange('5m');
      expect(info.display).to.be('Last 5 minutes')
    });

    it('should have singular when amount is 1', () => {
      var info = rangeUtil.describeTextRange('1h');
      expect(info.display).to.be('Last 1 hour')
    });

    it('should handle now/d', () => {
      var info = rangeUtil.describeTextRange('now/d');
      expect(info.display).to.be('The day so far');
    });

    it('should handle now/w', () => {
      var info = rangeUtil.describeTextRange('now/w');
      expect(info.display).to.be('Week to date');
    });


  });

});
