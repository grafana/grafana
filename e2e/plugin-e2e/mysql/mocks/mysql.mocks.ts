export const normalTableName = 'normalTable';
export const tableNameWithSpecialCharacter = 'table-name';
export const tablesResponse = {
  results: {
    tables: {
      status: 200,
      frames: [
        {
          schema: {
            refId: 'tables',
            meta: {
              executedQueryString:
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'DataMaker' ORDER BY table_name",
            },
            fields: [{ name: 'TABLE_NAME', type: 'string', typeInfo: { frame: 'string', nullable: true } }],
          },
          data: { values: [[normalTableName, tableNameWithSpecialCharacter]] },
        },
      ],
    },
  },
};

export const fieldsResponse = (refId: string) => ({
  results: {
    [refId]: {
      status: 200,
      frames: [
        {
          schema: {
            refId,
            meta: {
              executedQueryString:
                "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'DataMaker' AND table_name = 'RandomIntsWithTimes' ORDER BY column_name",
            },
            fields: [
              { name: 'COLUMN_NAME', type: 'string', typeInfo: { frame: 'string', nullable: true } },
              { name: 'DATA_TYPE', type: 'string', typeInfo: { frame: 'string', nullable: true } },
            ],
          },
          data: {
            values: [
              ['createdAt', 'id', 'time', 'updatedAt', 'bigint'],
              ['datetime', 'int', 'datetime', 'datetime', 'int'],
            ],
          },
        },
      ],
    },
  },
});

export const datasetResponse = {
  results: {
    datasets: {
      status: 200,
      frames: [
        {
          schema: {
            refId: 'datasets',
            meta: {
              executedQueryString:
                "SELECT DISTINCT TABLE_SCHEMA from information_schema.TABLES where TABLE_TYPE != 'SYSTEM VIEW' ORDER BY TABLE_SCHEMA",
            },
            fields: [{ name: 'TABLE_SCHEMA', type: 'string', typeInfo: { frame: 'string', nullable: true } }],
          },
          data: { values: [['DataMaker', 'mysql', 'performance_schema', 'sys']] },
        },
      ],
    },
  },
};
