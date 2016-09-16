import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

import {containsVariable} from '../variable';

describe('containsVariable', function() {

  describe('when checking if a string contains a variable', function() {

    it('should find it with $var syntax', function() {
      var contains = containsVariable('this.$test.filters', 'test');
      expect(contains).to.be(true);
    });

    it('should not find it if only part matches with $var syntax', function() {
      var contains = containsVariable('this.$ServerDomain.filters', 'Server');
      expect(contains).to.be(false);
    });

    it('should find it with [[var]] syntax', function() {
      var contains = containsVariable('this.[[test]].filters', 'test');
      expect(contains).to.be(true);
    });

    it('should find it when part of segment', function() {
      var contains = containsVariable('metrics.$env.$group-*', 'group');
      expect(contains).to.be(true);
    });

    it('should find it its the only thing', function() {
      var contains = containsVariable('$env', 'env');
      expect(contains).to.be(true);
    });
  });

});

