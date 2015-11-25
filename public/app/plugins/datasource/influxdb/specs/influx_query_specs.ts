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
            {type: 'field', params: ['value']},
            {type: 'mean', params: []},
            {type: 'math', params: ['/100']},
            {type: 'alias', params: ['text']},
          ]
        ]
      });

      var queryText = query.render();
      expect(queryText).to.be('SELECT mean("value") /100 AS "text" FROM "cpu" WHERE $timeFilter GROUP BY time($interval)');
    });
  });

  describe('when adding select part', function() {

    it('should add mean after after field', function() {
      var query = new InfluxQuery({
        measurement: 'cpu',
        select: [[{type: 'field', params: ['value']}]]
      });

      query.addSelectPart(query.selectModels[0], 'mean');
      expect(query.target.select[0].length).to.be(2);
      expect(query.target.select[0][1].type).to.be('mean');
    });

    it('should replace sum by mean', function() {
      var query = new InfluxQuery({
        measurement: 'cpu',
        select: [[{type: 'field', params: ['value']}, {type: 'mean'}]]
      });

      query.addSelectPart(query.selectModels[0], 'sum');
      expect(query.target.select[0].length).to.be(2);
      expect(query.target.select[0][1].type).to.be('sum');
    });

    it('should add math before alias', function() {
      var query = new InfluxQuery({
        measurement: 'cpu',
        select: [[{type: 'field', params: ['value']}, {type: 'mean'}, {type: 'alias'}]]
      });

      query.addSelectPart(query.selectModels[0], 'math');
      expect(query.target.select[0].length).to.be(4);
      expect(query.target.select[0][2].type).to.be('math');
    });

    it('should add math last', function() {
      var query = new InfluxQuery({
        measurement: 'cpu',
        select: [[{type: 'field', params: ['value']}, {type: 'mean'}]]
      });

      query.addSelectPart(query.selectModels[0], 'math');
      expect(query.target.select[0].length).to.be(3);
      expect(query.target.select[0][2].type).to.be('math');
    });

    it('should replace math', function() {
      var query = new InfluxQuery({
        measurement: 'cpu',
        select: [[{type: 'field', params: ['value']}, {type: 'mean'}, {type: 'math'}]]
      });

      query.addSelectPart(query.selectModels[0], 'math');
      expect(query.target.select[0].length).to.be(3);
      expect(query.target.select[0][2].type).to.be('math');
    });

  });

});
