import InfluxQuery from '../influx_query';

describe('InfluxQuery', function() {
  var templateSrv = { replace: val => val };

  describe('render series with mesurement only', function() {
    it('should generate correct query', function() {
      var query = new InfluxQuery(
        {
          measurement: 'cpu',
        },
        templateSrv,
        {}
      );

      var queryText = query.render();
      expect(queryText).toBe('SELECT mean("value") FROM "cpu" WHERE $timeFilter GROUP BY time($__interval) fill(null)');
    });
  });

  describe('render series with policy only', function() {
    it('should generate correct query', function() {
      var query = new InfluxQuery(
        {
          measurement: 'cpu',
          policy: '5m_avg',
        },
        templateSrv,
        {}
      );

      var queryText = query.render();
      expect(queryText).toBe(
        'SELECT mean("value") FROM "5m_avg"."cpu" WHERE $timeFilter GROUP BY time($__interval) fill(null)'
      );
    });
  });

  describe('render series with math and alias', function() {
    it('should generate correct query', function() {
      var query = new InfluxQuery(
        {
          measurement: 'cpu',
          select: [
            [
              { type: 'field', params: ['value'] },
              { type: 'mean', params: [] },
              { type: 'math', params: ['/100'] },
              { type: 'alias', params: ['text'] },
            ],
          ],
        },
        templateSrv,
        {}
      );

      var queryText = query.render();
      expect(queryText).toBe(
        'SELECT mean("value") /100 AS "text" FROM "cpu" WHERE $timeFilter GROUP BY time($__interval) fill(null)'
      );
    });
  });

  describe('series with single tag only', function() {
    it('should generate correct query', function() {
      var query = new InfluxQuery(
        {
          measurement: 'cpu',
          groupBy: [{ type: 'time', params: ['auto'] }],
          tags: [{ key: 'hostname', value: 'server\\1' }],
        },
        templateSrv,
        {}
      );

      var queryText = query.render();

      expect(queryText).toBe(
        'SELECT mean("value") FROM "cpu" WHERE ("hostname" = \'server\\\\1\') AND $timeFilter' +
          ' GROUP BY time($__interval)'
      );
    });

    it('should switch regex operator with tag value is regex', function() {
      var query = new InfluxQuery(
        {
          measurement: 'cpu',
          groupBy: [{ type: 'time', params: ['auto'] }],
          tags: [{ key: 'app', value: '/e.*/' }],
        },
        templateSrv,
        {}
      );

      var queryText = query.render();
      expect(queryText).toBe(
        'SELECT mean("value") FROM "cpu" WHERE ("app" =~ /e.*/) AND $timeFilter GROUP BY time($__interval)'
      );
    });
  });

  describe('series with multiple tags only', function() {
    it('should generate correct query', function() {
      var query = new InfluxQuery(
        {
          measurement: 'cpu',
          groupBy: [{ type: 'time', params: ['auto'] }],
          tags: [{ key: 'hostname', value: 'server1' }, { key: 'app', value: 'email', condition: 'AND' }],
        },
        templateSrv,
        {}
      );

      var queryText = query.render();
      expect(queryText).toBe(
        'SELECT mean("value") FROM "cpu" WHERE ("hostname" = \'server1\' AND "app" = \'email\') AND ' +
          '$timeFilter GROUP BY time($__interval)'
      );
    });
  });

  describe('series with tags OR condition', function() {
    it('should generate correct query', function() {
      var query = new InfluxQuery(
        {
          measurement: 'cpu',
          groupBy: [{ type: 'time', params: ['auto'] }],
          tags: [{ key: 'hostname', value: 'server1' }, { key: 'hostname', value: 'server2', condition: 'OR' }],
        },
        templateSrv,
        {}
      );

      var queryText = query.render();
      expect(queryText).toBe(
        'SELECT mean("value") FROM "cpu" WHERE ("hostname" = \'server1\' OR "hostname" = \'server2\') AND ' +
          '$timeFilter GROUP BY time($__interval)'
      );
    });
  });

  describe('query with value condition', function() {
    it('should not quote value', function() {
      var query = new InfluxQuery(
        {
          measurement: 'cpu',
          groupBy: [],
          tags: [{ key: 'value', value: '5', operator: '>' }],
        },
        templateSrv,
        {}
      );

      var queryText = query.render();
      expect(queryText).toBe('SELECT mean("value") FROM "cpu" WHERE ("value" > 5) AND $timeFilter');
    });
  });

  describe('series with groupByTag', function() {
    it('should generate correct query', function() {
      var query = new InfluxQuery(
        {
          measurement: 'cpu',
          tags: [],
          groupBy: [{ type: 'time', interval: 'auto' }, { type: 'tag', params: ['host'] }],
        },
        templateSrv,
        {}
      );

      var queryText = query.render();
      expect(queryText).toBe('SELECT mean("value") FROM "cpu" WHERE $timeFilter GROUP BY time($__interval), "host"');
    });
  });

  describe('render series without group by', function() {
    it('should generate correct query', function() {
      var query = new InfluxQuery(
        {
          measurement: 'cpu',
          select: [[{ type: 'field', params: ['value'] }]],
          groupBy: [],
        },
        templateSrv,
        {}
      );
      var queryText = query.render();
      expect(queryText).toBe('SELECT "value" FROM "cpu" WHERE $timeFilter');
    });
  });

  describe('render series without group by and fill', function() {
    it('should generate correct query', function() {
      var query = new InfluxQuery(
        {
          measurement: 'cpu',
          select: [[{ type: 'field', params: ['value'] }]],
          groupBy: [{ type: 'time' }, { type: 'fill', params: ['0'] }],
        },
        templateSrv,
        {}
      );
      var queryText = query.render();
      expect(queryText).toBe('SELECT "value" FROM "cpu" WHERE $timeFilter GROUP BY time($__interval) fill(0)');
    });
  });

  describe('when adding group by part', function() {
    it('should add tag before fill', function() {
      var query = new InfluxQuery(
        {
          measurement: 'cpu',
          groupBy: [{ type: 'time' }, { type: 'fill' }],
        },
        templateSrv,
        {}
      );

      query.addGroupBy('tag(host)');
      expect(query.target.groupBy.length).toBe(3);
      expect(query.target.groupBy[1].type).toBe('tag');
      expect(query.target.groupBy[1].params[0]).toBe('host');
      expect(query.target.groupBy[2].type).toBe('fill');
    });

    it('should add tag last if no fill', function() {
      var query = new InfluxQuery(
        {
          measurement: 'cpu',
          groupBy: [],
        },
        templateSrv,
        {}
      );

      query.addGroupBy('tag(host)');
      expect(query.target.groupBy.length).toBe(1);
      expect(query.target.groupBy[0].type).toBe('tag');
    });
  });

  describe('when adding select part', function() {
    it('should add mean after after field', function() {
      var query = new InfluxQuery(
        {
          measurement: 'cpu',
          select: [[{ type: 'field', params: ['value'] }]],
        },
        templateSrv,
        {}
      );

      query.addSelectPart(query.selectModels[0], 'mean');
      expect(query.target.select[0].length).toBe(2);
      expect(query.target.select[0][1].type).toBe('mean');
    });

    it('should replace sum by mean', function() {
      var query = new InfluxQuery(
        {
          measurement: 'cpu',
          select: [[{ type: 'field', params: ['value'] }, { type: 'mean' }]],
        },
        templateSrv,
        {}
      );

      query.addSelectPart(query.selectModels[0], 'sum');
      expect(query.target.select[0].length).toBe(2);
      expect(query.target.select[0][1].type).toBe('sum');
    });

    it('should add math before alias', function() {
      var query = new InfluxQuery(
        {
          measurement: 'cpu',
          select: [[{ type: 'field', params: ['value'] }, { type: 'mean' }, { type: 'alias' }]],
        },
        templateSrv,
        {}
      );

      query.addSelectPart(query.selectModels[0], 'math');
      expect(query.target.select[0].length).toBe(4);
      expect(query.target.select[0][2].type).toBe('math');
    });

    it('should add math last', function() {
      var query = new InfluxQuery(
        {
          measurement: 'cpu',
          select: [[{ type: 'field', params: ['value'] }, { type: 'mean' }]],
        },
        templateSrv,
        {}
      );

      query.addSelectPart(query.selectModels[0], 'math');
      expect(query.target.select[0].length).toBe(3);
      expect(query.target.select[0][2].type).toBe('math');
    });

    it('should replace math', function() {
      var query = new InfluxQuery(
        {
          measurement: 'cpu',
          select: [[{ type: 'field', params: ['value'] }, { type: 'mean' }, { type: 'math' }]],
        },
        templateSrv,
        {}
      );

      query.addSelectPart(query.selectModels[0], 'math');
      expect(query.target.select[0].length).toBe(3);
      expect(query.target.select[0][2].type).toBe('math');
    });

    it('should add math when one only query part', function() {
      var query = new InfluxQuery(
        {
          measurement: 'cpu',
          select: [[{ type: 'field', params: ['value'] }]],
        },
        templateSrv,
        {}
      );

      query.addSelectPart(query.selectModels[0], 'math');
      expect(query.target.select[0].length).toBe(2);
      expect(query.target.select[0][1].type).toBe('math');
    });

    describe('when render adhoc filters', function() {
      it('should generate correct query segment', function() {
        var query = new InfluxQuery({ measurement: 'cpu' }, templateSrv, {});

        var queryText = query.renderAdhocFilters([
          { key: 'key1', operator: '=', value: 'value1' },
          { key: 'key2', operator: '!=', value: 'value2' },
        ]);

        expect(queryText).toBe('"key1" = \'value1\' AND "key2" != \'value2\'');
      });
    });
  });
});
