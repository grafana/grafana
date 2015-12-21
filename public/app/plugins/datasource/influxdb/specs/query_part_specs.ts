
import {describe, beforeEach, it, sinon, expect} from 'test/lib/common';

import queryPart from '../query_part';

describe('InfluxQueryPart', () => {

  describe('series with mesurement only', () => {
    it('should handle nested function parts', () => {
      var part = queryPart.create({
        type: 'derivative',
        params: ['10s'],
      });

      expect(part.text).to.be('derivative(10s)');
      expect(part.render('mean(value)')).to.be('derivative(mean(value), 10s)');
    });

    it('should handle suffirx parts', () => {
      var part = queryPart.create({
        type: 'math',
        params: ['/ 100'],
      });

      expect(part.text).to.be('math(/ 100)');
      expect(part.render('mean(value)')).to.be('mean(value) / 100');
    });

    it('should handle alias parts', () => {
      var part = queryPart.create({
        type: 'alias',
        params: ['test'],
      });

      expect(part.text).to.be('alias(test)');
      expect(part.render('mean(value)')).to.be('mean(value) AS "test"');
    });

  });

});
