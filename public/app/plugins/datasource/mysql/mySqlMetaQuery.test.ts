import { buildTableQuery } from './mySqlMetaQuery';

describe('buildTableQuery', () => {
  it('should build table query with parameter `grafana`', () => {
    expect(buildTableQuery('`grafana`')).toBe(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'grafana' ORDER BY table_name`
    );
  });
});
