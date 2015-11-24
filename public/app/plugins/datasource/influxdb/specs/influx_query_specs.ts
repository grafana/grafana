import {describe, beforeEach, it, sinon, expect} from 'test/lib/common';

import InfluxQuery = require('../influx_query');

describe.only('InfluxQuery', function() {

  describe('series with mesurement only', function() {
    it('should generate correct query', function() {
      var query = new InfluxQuery({
        measurement: 'cpu',
      });

      var queryText = query.render();
      expect(queryText).to.be('SELECT mean("value") FROM "cpu" WHERE $timeFilter GROUP BY time($interval)');
    });
  });

  describe('series with math and alias', function() {
    it('should generate correct query', function() {
      var query = new InfluxQuery({
        measurement: 'cpu',
        select: [
          [
            {name: 'field', params: ['value']},
            {name: 'mean', params: []},
            {name: 'math', params: ['/100']},
            {name: 'alias', params: ['text']},
          ]
        ]
      });

      var queryText = query.render();
      expect(queryText).to.be('SELECT mean("value") /100 AS "text" FROM "cpu" WHERE $timeFilter GROUP BY time($interval)');
    });
  });

});
