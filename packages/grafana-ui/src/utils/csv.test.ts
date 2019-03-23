import { readCSV, readCSVFromStream } from './csv';

const fs = require('fs');
const Readable = require('stream').Readable;

describe('read csv', () => {
  it('should get X and y', () => {
    const text = ',1\n2,3,4\n5,6\n,,,7';
    return readCSV(text).then(tables => {
      expect(tables.length).toBe(1);

      const table = tables[0];
      expect(table.columns.length).toBe(4);
      expect(table.rows.length).toBe(3);

      // Make sure everythign it padded properly
      for (const row of table.rows) {
        expect(row.length).toBe(table.columns.length);
      }

      expect(tables[0]).toMatchSnapshot();
    });
  });

  it('should read csv from local file system', () => {
    const path = __dirname + '/testdata/simple.csv';
    console.log('PATH', path);
    expect(fs.existsSync(path)).toBeTruthy();

    const stream = fs.createReadStream(path, 'utf8');
    return readCSVFromStream(stream).then(tables => {
      //expect(tables.length).toBe(1);
      expect(tables[0]).toMatchSnapshot();
    });
  });
});
