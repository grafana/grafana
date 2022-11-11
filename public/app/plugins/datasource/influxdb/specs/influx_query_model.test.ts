import InfluxQueryModel from '../influx_query_model';

describe('InfluxQuery', () => {
  const templateSrv: any = { replace: (val: any) => val };

  describe('render series with measurement only', () => {
    it('should generate correct query', () => {
      const query = new InfluxQueryModel(
        {
          refId: 'A',
          measurement: 'cpu',
        },
        templateSrv,
        {}
      );

      const queryText = query.render();
      expect(queryText).toBe('SELECT mean("value") FROM "cpu" WHERE $timeFilter GROUP BY time($__interval) fill(null)');
    });
  });

  describe('render series with policy only', () => {
    it('should generate correct query', () => {
      const query = new InfluxQueryModel(
        {
          refId: 'A',
          measurement: 'cpu',
          policy: '5m_avg',
        },
        templateSrv,
        {}
      );

      const queryText = query.render();
      expect(queryText).toBe(
        'SELECT mean("value") FROM "5m_avg"."cpu" WHERE $timeFilter GROUP BY time($__interval) fill(null)'
      );
    });
  });

  describe('render series with math and alias', () => {
    it('should generate correct query', () => {
      const query = new InfluxQueryModel(
        {
          refId: 'A',
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

      const queryText = query.render();
      expect(queryText).toBe(
        'SELECT mean("value") /100 AS "text" FROM "cpu" WHERE $timeFilter GROUP BY time($__interval) fill(null)'
      );
    });
  });

  describe('series with single tag only', () => {
    it('should generate correct query', () => {
      const query = new InfluxQueryModel(
        {
          refId: 'A',
          measurement: 'cpu',
          groupBy: [{ type: 'time', params: ['auto'] }],
          tags: [{ key: 'hostname', value: 'server\\1' }],
        },
        templateSrv,
        {}
      );

      const queryText = query.render();

      expect(queryText).toBe(
        'SELECT mean("value") FROM "cpu" WHERE ("hostname" = \'server\\\\1\') AND $timeFilter' +
          ' GROUP BY time($__interval)'
      );
    });

    it('should switch regex operator with tag value is regex', () => {
      const query = new InfluxQueryModel(
        {
          refId: 'A',
          measurement: 'cpu',
          groupBy: [{ type: 'time', params: ['auto'] }],
          tags: [{ key: 'app', value: '/e.*/' }],
        },
        templateSrv,
        {}
      );

      const queryText = query.render();
      expect(queryText).toBe(
        'SELECT mean("value") FROM "cpu" WHERE ("app" =~ /e.*/) AND $timeFilter GROUP BY time($__interval)'
      );
    });
  });

  describe('series with multiple tags only', () => {
    it('should generate correct query', () => {
      const query = new InfluxQueryModel(
        {
          refId: 'A',
          measurement: 'cpu',
          groupBy: [{ type: 'time', params: ['auto'] }],
          tags: [
            { key: 'hostname', value: 'server1' },
            { key: 'app', value: 'email', condition: 'AND' },
          ],
        },
        templateSrv,
        {}
      );

      const queryText = query.render();
      expect(queryText).toBe(
        'SELECT mean("value") FROM "cpu" WHERE ("hostname" = \'server1\' AND "app" = \'email\') AND ' +
          '$timeFilter GROUP BY time($__interval)'
      );
    });
  });

  describe('series with tags OR condition', () => {
    it('should generate correct query', () => {
      const query = new InfluxQueryModel(
        {
          refId: 'A',
          measurement: 'cpu',
          groupBy: [{ type: 'time', params: ['auto'] }],
          tags: [
            { key: 'hostname', value: 'server1' },
            { key: 'hostname', value: 'server2', condition: 'OR' },
          ],
        },
        templateSrv,
        {}
      );

      const queryText = query.render();
      expect(queryText).toBe(
        'SELECT mean("value") FROM "cpu" WHERE ("hostname" = \'server1\' OR "hostname" = \'server2\') AND ' +
          '$timeFilter GROUP BY time($__interval)'
      );
    });
  });

  describe('field name with single quote should be escaped and', () => {
    it('should generate correct query', () => {
      const query = new InfluxQueryModel(
        {
          refId: 'A',
          measurement: 'cpu',
          groupBy: [{ type: 'time', params: ['auto'] }],
          tags: [
            { key: 'name', value: "Let's encrypt." },
            { key: 'hostname', value: 'server2', condition: 'OR' },
          ],
        },
        templateSrv,
        {}
      );

      const queryText = query.render();
      expect(queryText).toBe(
        'SELECT mean("value") FROM "cpu" WHERE ("name" = \'Let\\\'s encrypt.\' OR "hostname" = \'server2\') AND ' +
          '$timeFilter GROUP BY time($__interval)'
      );
    });
  });

  describe('query with value condition', () => {
    it('should not quote value', () => {
      const query = new InfluxQueryModel(
        {
          refId: 'A',
          measurement: 'cpu',
          groupBy: [],
          tags: [{ key: 'value', value: '5', operator: '>' }],
        },
        templateSrv,
        {}
      );

      const queryText = query.render();
      expect(queryText).toBe('SELECT mean("value") FROM "cpu" WHERE ("value" > 5) AND $timeFilter');
    });
  });

  describe('series with groupByTag', () => {
    it('should generate correct query', () => {
      const query = new InfluxQueryModel(
        {
          refId: 'A',
          measurement: 'cpu',
          tags: [],
          groupBy: [
            { type: 'time', interval: 'auto' },
            { type: 'tag', params: ['host'] },
          ],
        },
        templateSrv,
        {}
      );

      const queryText = query.render();
      expect(queryText).toBe('SELECT mean("value") FROM "cpu" WHERE $timeFilter GROUP BY time($__interval), "host"');
    });
  });

  describe('render series without group by', () => {
    it('should generate correct query', () => {
      const query = new InfluxQueryModel(
        {
          refId: 'A',
          measurement: 'cpu',
          select: [[{ type: 'field', params: ['value'] }]],
          groupBy: [],
        },
        templateSrv,
        {}
      );
      const queryText = query.render();
      expect(queryText).toBe('SELECT "value" FROM "cpu" WHERE $timeFilter');
    });
  });

  describe('render series without group by and fill', () => {
    it('should generate correct query', () => {
      const query = new InfluxQueryModel(
        {
          refId: 'A',
          measurement: 'cpu',
          select: [[{ type: 'field', params: ['value'] }]],
          groupBy: [{ type: 'time' }, { type: 'fill', params: ['0'] }],
        },
        templateSrv,
        {}
      );
      const queryText = query.render();
      expect(queryText).toBe('SELECT "value" FROM "cpu" WHERE $timeFilter GROUP BY time($__interval) fill(0)');
    });
  });

  describe('when adding group by part', () => {
    it('should add tag before fill', () => {
      const query = new InfluxQueryModel(
        {
          refId: 'A',
          measurement: 'cpu',
          groupBy: [{ type: 'time' }, { type: 'fill' }],
        },
        templateSrv,
        {}
      );

      query.addGroupBy('tag(host)');
      expect(query.target.groupBy?.length).toBe(3);
      expect(query.target.groupBy![1].type).toBe('tag');
      expect(query.target.groupBy![1].params![0]).toBe('host');
      expect(query.target.groupBy![2].type).toBe('fill');
    });

    it('should add tag last if no fill', () => {
      const query = new InfluxQueryModel(
        {
          refId: 'A',
          measurement: 'cpu',
          groupBy: [],
        },
        templateSrv,
        {}
      );

      query.addGroupBy('tag(host)');
      expect(query.target.groupBy?.length).toBe(1);
      expect(query.target.groupBy![0].type).toBe('tag');
    });
  });

  describe('when adding select part', () => {
    it('should add mean after after field', () => {
      const query = new InfluxQueryModel(
        {
          refId: 'A',
          measurement: 'cpu',
          select: [[{ type: 'field', params: ['value'] }]],
        },
        templateSrv,
        {}
      );

      query.addSelectPart(query.selectModels[0], 'mean');
      expect(query.target.select![0].length).toBe(2);
      expect(query.target.select![0][1].type).toBe('mean');
    });

    it('should replace sum by mean', () => {
      const query = new InfluxQueryModel(
        {
          refId: 'A',
          measurement: 'cpu',
          select: [[{ type: 'field', params: ['value'] }, { type: 'mean' }]],
        },
        templateSrv,
        {}
      );

      query.addSelectPart(query.selectModels[0], 'sum');
      expect(query.target.select![0].length).toBe(2);
      expect(query.target.select![0][1].type).toBe('sum');
    });

    it('should add math before alias', () => {
      const query = new InfluxQueryModel(
        {
          refId: 'A',
          measurement: 'cpu',
          select: [[{ type: 'field', params: ['value'] }, { type: 'mean' }, { type: 'alias' }]],
        },
        templateSrv,
        {}
      );

      query.addSelectPart(query.selectModels[0], 'math');
      expect(query.target.select![0].length).toBe(4);
      expect(query.target.select![0][2].type).toBe('math');
    });

    it('should add math last', () => {
      const query = new InfluxQueryModel(
        {
          refId: 'A',
          measurement: 'cpu',
          select: [[{ type: 'field', params: ['value'] }, { type: 'mean' }]],
        },
        templateSrv,
        {}
      );

      query.addSelectPart(query.selectModels[0], 'math');
      expect(query.target.select![0].length).toBe(3);
      expect(query.target.select![0][2].type).toBe('math');
    });

    it('should replace math', () => {
      const query = new InfluxQueryModel(
        {
          refId: 'A',
          measurement: 'cpu',
          select: [[{ type: 'field', params: ['value'] }, { type: 'mean' }, { type: 'math' }]],
        },
        templateSrv,
        {}
      );

      query.addSelectPart(query.selectModels[0], 'math');
      expect(query.target.select![0].length).toBe(3);
      expect(query.target.select![0][2].type).toBe('math');
    });

    it('should add math when one only query part', () => {
      const query = new InfluxQueryModel(
        {
          refId: 'A',
          measurement: 'cpu',
          select: [[{ type: 'field', params: ['value'] }]],
        },
        templateSrv,
        {}
      );

      query.addSelectPart(query.selectModels[0], 'math');
      expect(query.target.select![0].length).toBe(2);
      expect(query.target.select![0][1].type).toBe('math');
    });

    describe('when render adhoc filters', () => {
      it('should generate correct query segment', () => {
        const query = new InfluxQueryModel({ refId: 'A', measurement: 'cpu' }, templateSrv, {});

        const queryText = query.renderAdhocFilters([
          { key: 'key1', operator: '=', value: 'value1' },
          { key: 'key2', operator: '!=', value: 'value2' },
        ]);

        expect(queryText).toBe('"key1" = \'value1\' AND "key2" != \'value2\'');
      });
    });
  });
});
