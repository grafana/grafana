
import {describe, beforeEach, it, sinon, expect} from 'test/lib/common';

import queryPart = require('../query_part');

describe('InfluxQueryBuilder', () => {

  describe('series with mesurement only', () => {
    it('should handle nested function parts', () => {
      var part = queryPart.create({
        name: 'derivative',
        params: ['10s'],
      });

      expect(part.text).to.be('derivative(10s)');
      expect(part.render('mean(value)')).to.be('derivative(mean(value), 10s)');
    });

    it('should handle suffirx parts', () => {
      var part = queryPart.create({
        name: 'math',
        params: ['/ 100'],
      });

      expect(part.text).to.be('math(/ 100)');
      expect(part.render('mean(value)')).to.be('mean(value) / 100');
    });

    it('should handle alias parts', () => {
      var part = queryPart.create({
        name: 'alias',
        params: ['test'],
      });

      expect(part.text).to.be('alias(test)');
      expect(part.render('mean(value)')).to.be('mean(value) AS "test"');
    });

  });

});
