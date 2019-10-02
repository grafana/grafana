import { readCSV, toCSV, CSVHeaderStyle } from './csv';
import { getDataFrameRow } from '../dataframe/processDataFrame';

// Test with local CSV files
import fs from 'fs';
import { toDataFrameDTO } from '../dataframe/processDataFrame';

describe('read csv', () => {
  it('should get X and y', () => {
    const text = ',1\n2,3,4\n5,6\n,,,7';
    const data = readCSV(text);
    expect(data.length).toBe(1);

    const series = data[0];
    expect(series.fields.length).toBe(4);

    const rows = 4;
    expect(series.length).toBe(rows);

    // Make sure everythign it padded properly
    for (const field of series.fields) {
      expect(field.values.length).toBe(rows);
    }

    const dto = toDataFrameDTO(series);
    expect(dto).toMatchSnapshot();
  });

  it('should read single string OK', () => {
    const text = 'a,b,c';
    const data = readCSV(text);
    expect(data.length).toBe(1);

    const series = data[0];
    expect(series.fields.length).toBe(3);
    expect(series.length).toBe(0);

    expect(series.fields[0].name).toEqual('a');
    expect(series.fields[1].name).toEqual('b');
    expect(series.fields[2].name).toEqual('c');
  });

  it('should read csv from local file system', () => {
    const path = __dirname + '/testdata/simple.csv';
    expect(fs.existsSync(path)).toBeTruthy();

    const csv = fs.readFileSync(path, 'utf8');
    const data = readCSV(csv);
    expect(data.length).toBe(1);
    expect(toDataFrameDTO(data[0])).toMatchSnapshot();
  });

  it('should read csv with headers', () => {
    const path = __dirname + '/testdata/withHeaders.csv';
    expect(fs.existsSync(path)).toBeTruthy();

    const csv = fs.readFileSync(path, 'utf8');
    const data = readCSV(csv);
    expect(data.length).toBe(1);
    expect(toDataFrameDTO(data[0])).toMatchSnapshot();
  });
});

function norm(csv: string): string {
  return csv.trim().replace(/[\r]/g, '');
}

describe('write csv', () => {
  it('should write the same CSV that we read', () => {
    const firstRow = [10, 'this "has quotes" inside', true];
    const path = __dirname + '/testdata/roundtrip.csv';
    const csv = fs.readFileSync(path, 'utf8');
    const data = readCSV(csv);
    const out = toCSV(data, { headerStyle: CSVHeaderStyle.full });
    expect(data.length).toBe(1);
    expect(getDataFrameRow(data[0], 0)).toEqual(firstRow);
    expect(data[0].fields.length).toBe(3);
    expect(norm(out)).toBe(norm(csv));

    // Keep the name even without special formatting
    const again = readCSV(out);
    const shorter = toCSV(again, { headerStyle: CSVHeaderStyle.name });

    const f = readCSV(shorter);
    const fields = f[0].fields;
    expect(fields.length).toBe(3);
    expect(getDataFrameRow(f[0], 0)).toEqual(firstRow);
    expect(fields.map(f => f.name).join(',')).toEqual('a,b,c'); // the names
  });
});
