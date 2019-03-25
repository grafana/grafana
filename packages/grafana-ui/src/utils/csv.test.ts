import { readCSV, toCSV } from './csv';

const fs = require('fs');

describe('read csv', () => {
  it('should get X and y', () => {
    const text = ',1\n2,3,4\n5,6\n,,,7';
    return readCSV(text).then(data => {
      expect(data.length).toBe(1);

      const series = data[0];
      expect(series.fields.length).toBe(4);
      expect(series.rows.length).toBe(3);

      // Make sure everythign it padded properly
      for (const row of series.rows) {
        expect(row.length).toBe(series.fields.length);
      }

      expect(series).toMatchSnapshot();
    });
  });

  it('should read csv from local file system', () => {
    const path = __dirname + '/testdata/simple.csv';
    expect(fs.existsSync(path)).toBeTruthy();

    const csv = fs.readFileSync(path, 'utf8');
    return readCSV(csv).then(data => {
      expect(data.length).toBe(1);
      expect(data[0]).toMatchSnapshot();
    });
  });

  it('should read csv with headers', () => {
    const path = __dirname + '/testdata/withHeaders.csv';
    expect(fs.existsSync(path)).toBeTruthy();

    const csv = fs.readFileSync(path, 'utf8');
    return readCSV(csv).then(data => {
      expect(data.length).toBe(1);
      expect(data[0]).toMatchSnapshot();
    });
  });
});

function norm(csv: string): string {
  return csv.trim().replace(/[\r]/g, '');
}

describe('write csv', () => {
  it('should write the same CSV that we read', () => {
    const path = __dirname + '/testdata/roundtrip.csv';
    const csv = fs.readFileSync(path, 'utf8');
    return readCSV(csv).then(data => {
      const out = toCSV(data);
      expect(data.length).toBe(1);
      expect(data[0].fields.length).toBe(3);
      expect(norm(out)).toBe(norm(csv));
    });
  });
});
