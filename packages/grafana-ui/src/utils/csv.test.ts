import { readCSV, toCSV, CSVHeaderStyle } from './csv';

// Test with local CSV files
const fs = require('fs');

describe('read csv', () => {
  it('should get X and y', () => {
    const text = ',1\n2,3,4\n5,6\n,,,7';
    const data = readCSV(text);
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

  it('should read csv from local file system', () => {
    const path = __dirname + '/testdata/simple.csv';
    expect(fs.existsSync(path)).toBeTruthy();

    const csv = fs.readFileSync(path, 'utf8');
    const data = readCSV(csv);
    expect(data.length).toBe(1);
    expect(data[0]).toMatchSnapshot();
  });

  it('should read csv with headers', () => {
    const path = __dirname + '/testdata/withHeaders.csv';
    expect(fs.existsSync(path)).toBeTruthy();

    const csv = fs.readFileSync(path, 'utf8');
    const data = readCSV(csv);
    expect(data.length).toBe(1);
    expect(data[0]).toMatchSnapshot();
  });
});

function norm(csv: string): string {
  return csv.trim().replace(/[\r]/g, '');
}

describe('write csv', () => {
  it('should write the same CSV that we read', () => {
    const path = __dirname + '/testdata/roundtrip.csv';
    const csv = fs.readFileSync(path, 'utf8');
    const data = readCSV(csv);
    const out = toCSV(data, { headerStyle: CSVHeaderStyle.full });
    expect(data.length).toBe(1);
    expect(data[0].fields.length).toBe(3);
    expect(norm(out)).toBe(norm(csv));

    // Keep the name even without special formatting
    const again = readCSV(out);
    const shorter = toCSV(again, { headerStyle: CSVHeaderStyle.name });

    const f = readCSV(shorter);
    const fields = f[0].fields;
    expect(fields.length).toBe(3);
    expect(fields.map(f => f.name).join(',')).toEqual('a,b,c'); // the names
  });
});
