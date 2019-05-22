import LogAnalyticsQuerystringBuilder from './querystring_builder';
import { dateTime } from '@grafana/ui/src/utils/moment_wrapper';

describe('LogAnalyticsDatasource', () => {
  let builder: LogAnalyticsQuerystringBuilder;

  beforeEach(() => {
    builder = new LogAnalyticsQuerystringBuilder(
      'query=Tablename | where $__timeFilter()',
      {
        interval: '5m',
        range: {
          from: dateTime().subtract(24, 'hours'),
          to: dateTime(),
        },
        rangeRaw: {
          from: 'now-24h',
          to: 'now',
        },
      },
      'TimeGenerated'
    );
  });

  describe('when $__timeFilter has no column parameter', () => {
    it('should generate a time filter condition with TimeGenerated as the datetime field', () => {
      const query = builder.generate().uriString;

      expect(query).toContain('where%20TimeGenerated%20%3E%3D%20datetime(');
    });
  });

  describe('when $__timeFilter has a column parameter', () => {
    beforeEach(() => {
      builder.rawQueryString = 'query=Tablename | where $__timeFilter(myTime)';
    });

    it('should generate a time filter condition with myTime as the datetime field', () => {
      const query = builder.generate().uriString;

      expect(query).toContain('where%20myTime%20%3E%3D%20datetime(');
    });
  });

  describe('when $__contains and multi template variable has custom All value', () => {
    beforeEach(() => {
      builder.rawQueryString = 'query=Tablename | where $__contains(col, all)';
    });

    it('should generate a where..in clause', () => {
      const query = builder.generate().rawQuery;

      expect(query).toContain(`where 1 == 1`);
    });
  });

  describe('when $__contains and multi template variable has one selected value', () => {
    beforeEach(() => {
      builder.rawQueryString = `query=Tablename | where $__contains(col, 'val1')`;
    });

    it('should generate a where..in clause', () => {
      const query = builder.generate().rawQuery;

      expect(query).toContain(`where col in ('val1')`);
    });
  });

  describe('when $__contains and multi template variable has multiple selected values', () => {
    beforeEach(() => {
      builder.rawQueryString = `query=Tablename | where $__contains(col, 'val1','val2')`;
    });

    it('should generate a where..in clause', () => {
      const query = builder.generate().rawQuery;

      expect(query).toContain(`where col in ('val1','val2')`);
    });
  });

  describe('when $__interval is in the query', () => {
    beforeEach(() => {
      builder.rawQueryString = 'query=Tablename | summarize count() by Category, bin(TimeGenerated, $__interval)';
    });

    it('should replace $__interval with the inbuilt interval option', () => {
      const query = builder.generate().uriString;

      expect(query).toContain('bin(TimeGenerated%2C%205m');
    });
  });

  describe('when using $__timeFrom and $__timeTo is in the query and range is until now', () => {
    beforeEach(() => {
      builder.rawQueryString = 'query=Tablename | where myTime >= $__timeFrom() and myTime <= $__timeTo()';
    });

    it('should replace $__timeFrom and $__timeTo with a datetime and the now() function', () => {
      const query = builder.generate().uriString;

      expect(query).toContain('where%20myTime%20%3E%3D%20datetime(');
      expect(query).toContain('myTime%20%3C%3D%20datetime(');
    });
  });

  describe('when using $__timeFrom and $__timeTo is in the query and range is a specific interval', () => {
    beforeEach(() => {
      builder.rawQueryString = 'query=Tablename | where myTime >= $__timeFrom() and myTime <= $__timeTo()';
      builder.options.range.to = dateTime().subtract(1, 'hour');
      builder.options.rangeRaw.to = 'now-1h';
    });

    it('should replace $__timeFrom and $__timeTo with datetimes', () => {
      const query = builder.generate().uriString;

      expect(query).toContain('where%20myTime%20%3E%3D%20datetime(');
      expect(query).toContain('myTime%20%3C%3D%20datetime(');
    });
  });

  describe('when using $__escape and multi template variable has one selected value', () => {
    beforeEach(() => {
      builder.rawQueryString = `$__escapeMulti('\\grafana-vm\Network(eth0)\Total Bytes Received')`;
    });

    it('should replace $__escape(val) with KQL style escaped string', () => {
      const query = builder.generate().uriString;
      expect(query).toContain(`%40'%5Cgrafana-vmNetwork(eth0)Total%20Bytes%20Received'`);
    });
  });

  describe('when using $__escape and multi template variable has multiple selected values', () => {
    beforeEach(() => {
      builder.rawQueryString = `CounterPath in ($__escapeMulti('\\grafana-vm\Network(eth0)\Total','\\grafana-vm\Network(eth0)\Total'))`;
    });

    it('should replace $__escape(val) with multiple KQL style escaped string', () => {
      const query = builder.generate().uriString;
      expect(query).toContain(
        `CounterPath%20in%20(%40'%5Cgrafana-vmNetwork(eth0)Total'%2C%20%40'%5Cgrafana-vmNetwork(eth0)Total')`
      );
    });
  });

  describe('when using $__escape and multi template variable has one selected value that contains comma', () => {
    beforeEach(() => {
      builder.rawQueryString = `$__escapeMulti('\\grafana-vm,\Network(eth0)\Total Bytes Received')`;
    });

    it('should replace $__escape(val) with KQL style escaped string', () => {
      const query = builder.generate().uriString;
      expect(query).toContain(`%40'%5Cgrafana-vm%2CNetwork(eth0)Total%20Bytes%20Received'`);
    });
  });

  describe(`when using $__escape and multi template variable value is not wrapped in single '`, () => {
    beforeEach(() => {
      builder.rawQueryString = `$__escapeMulti(\\grafana-vm,\Network(eth0)\Total Bytes Received)`;
    });

    it('should not replace macro', () => {
      const query = builder.generate().uriString;
      expect(query).toContain(`%24__escapeMulti(%5Cgrafana-vm%2CNetwork(eth0)Total%20Bytes%20Received)`);
    });
  });
});
