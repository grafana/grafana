import TableModel, { mergeTablesIntoModel } from 'app/core/table_model';

describe('when sorting table desc', () => {
  let table;
  const panel = {
    sort: { col: 0, desc: true },
  };

  beforeEach(() => {
    table = new TableModel();
    table.columns = [{}, {}];
    table.rows = [[100, 12], [105, 10], [103, 11]];
    table.sort(panel.sort);
  });

  it('should sort by time', () => {
    expect(table.rows[0][0]).toBe(105);
    expect(table.rows[1][0]).toBe(103);
    expect(table.rows[2][0]).toBe(100);
  });

  it('should mark column being sorted', () => {
    expect(table.columns[0].sort).toBe(true);
    expect(table.columns[0].desc).toBe(true);
  });
});

describe('when sorting table asc', () => {
  let table;
  const panel = {
    sort: { col: 1, desc: false },
  };

  beforeEach(() => {
    table = new TableModel();
    table.columns = [{}, {}];
    table.rows = [[100, 11], [105, 15], [103, 10]];
    table.sort(panel.sort);
  });

  it('should sort by time', () => {
    expect(table.rows[0][1]).toBe(10);
    expect(table.rows[1][1]).toBe(11);
    expect(table.rows[2][1]).toBe(15);
  });
});

describe('when sorting with nulls', () => {
  let table;
  let values;

  beforeEach(() => {
    table = new TableModel();
    table.columns = [{}, {}];
    table.rows = [[42, ''], [19, 'a'], [null, 'b'], [0, 'd'], [null, null], [2, 'c'], [0, null], [-8, '']];
  });

  it('numbers with nulls at end with asc sort', () => {
    table.sort({ col: 0, desc: false });
    values = table.rows.map(row => row[0]);
    expect(values).toEqual([-8, 0, 0, 2, 19, 42, null, null]);
  });

  it('numbers with nulls at start with desc sort', () => {
    table.sort({ col: 0, desc: true });
    values = table.rows.map(row => row[0]);
    expect(values).toEqual([null, null, 42, 19, 2, 0, 0, -8]);
  });

  it('strings with nulls at end with asc sort', () => {
    table.sort({ col: 1, desc: false });
    values = table.rows.map(row => row[1]);
    expect(values).toEqual(['', '', 'a', 'b', 'c', 'd', null, null]);
  });

  it('strings with nulls at start with desc sort', () => {
    table.sort({ col: 1, desc: true });
    values = table.rows.map(row => row[1]);
    expect(values).toEqual([null, null, 'd', 'c', 'b', 'a', '', '']);
  });
});

describe('mergeTables', () => {
  const time = new Date().getTime();

  const singleTable = new TableModel({
    type: 'table',
    columns: [{ text: 'Time' }, { text: 'Label Key 1' }, { text: 'Value' }],
    rows: [[time, 'Label Value 1', 42]],
  });

  const multipleTablesSameColumns = [
    new TableModel({
      type: 'table',
      columns: [{ text: 'Time' }, { text: 'Label Key 1' }, { text: 'Label Key 2' }, { text: 'Value #A' }],
      rows: [[time, 'Label Value 1', 'Label Value 2', 42]],
    }),
    new TableModel({
      type: 'table',
      columns: [{ text: 'Time' }, { text: 'Label Key 1' }, { text: 'Label Key 2' }, { text: 'Value #B' }],
      rows: [[time, 'Label Value 1', 'Label Value 2', 13]],
    }),
    new TableModel({
      type: 'table',
      columns: [{ text: 'Time' }, { text: 'Label Key 1' }, { text: 'Label Key 2' }, { text: 'Value #C' }],
      rows: [[time, 'Label Value 1', 'Label Value 2', 4]],
    }),
    new TableModel({
      type: 'table',
      columns: [{ text: 'Time' }, { text: 'Label Key 1' }, { text: 'Label Key 2' }, { text: 'Value #C' }],
      rows: [[time, 'Label Value 1', 'Label Value 2', 7]],
    }),
  ];

  const multipleTablesDifferentColumns = [
    new TableModel({
      type: 'table',
      columns: [{ text: 'Time' }, { text: 'Label Key 1' }, { text: 'Value #A' }],
      rows: [[time, 'Label Value 1', 42]],
    }),
    new TableModel({
      type: 'table',
      columns: [{ text: 'Time' }, { text: 'Label Key 2' }, { text: 'Value #B' }],
      rows: [[time, 'Label Value 2', 13]],
    }),
    new TableModel({
      type: 'table',
      columns: [{ text: 'Time' }, { text: 'Label Key 1' }, { text: 'Value #C' }],
      rows: [[time, 'Label Value 3', 7]],
    }),
  ];

  it('should return the single table as is', () => {
    const table = mergeTablesIntoModel(new TableModel(), singleTable);
    expect(table.columns.length).toBe(3);
    expect(table.columns[0].text).toBe('Time');
    expect(table.columns[1].text).toBe('Label Key 1');
    expect(table.columns[2].text).toBe('Value');
  });

  it('should return the union of columns for multiple tables', () => {
    const table = mergeTablesIntoModel(new TableModel(), ...multipleTablesSameColumns);
    expect(table.columns.length).toBe(6);
    expect(table.columns[0].text).toBe('Time');
    expect(table.columns[1].text).toBe('Label Key 1');
    expect(table.columns[2].text).toBe('Label Key 2');
    expect(table.columns[3].text).toBe('Value #A');
    expect(table.columns[4].text).toBe('Value #B');
    expect(table.columns[5].text).toBe('Value #C');
  });

  it('should return 1 row for a single table', () => {
    const table = mergeTablesIntoModel(new TableModel(), singleTable);
    expect(table.rows.length).toBe(1);
    expect(table.rows[0][0]).toBe(time);
    expect(table.rows[0][1]).toBe('Label Value 1');
    expect(table.rows[0][2]).toBe(42);
  });

  it('should return 2 rows for a multiple tables with same column values plus one extra row', () => {
    const table = mergeTablesIntoModel(new TableModel(), ...multipleTablesSameColumns);
    expect(table.rows.length).toBe(2);
    expect(table.rows[0][0]).toBe(time);
    expect(table.rows[0][1]).toBe('Label Value 1');
    expect(table.rows[0][2]).toBe('Label Value 2');
    expect(table.rows[0][3]).toBe(42);
    expect(table.rows[0][4]).toBe(13);
    expect(table.rows[0][5]).toBe(4);
    expect(table.rows[1][0]).toBe(time);
    expect(table.rows[1][1]).toBe('Label Value 1');
    expect(table.rows[1][2]).toBe('Label Value 2');
    expect(table.rows[1][3]).toBeUndefined();
    expect(table.rows[1][4]).toBeUndefined();
    expect(table.rows[1][5]).toBe(7);
  });

  it('should return 2 rows for multiple tables with different column values', () => {
    const table = mergeTablesIntoModel(new TableModel(), ...multipleTablesDifferentColumns);
    expect(table.rows.length).toBe(2);
    expect(table.columns.length).toBe(6);

    expect(table.rows[0][0]).toBe(time);
    expect(table.rows[0][1]).toBe('Label Value 1');
    expect(table.rows[0][2]).toBe(42);
    expect(table.rows[0][3]).toBe('Label Value 2');
    expect(table.rows[0][4]).toBe(13);
    expect(table.rows[0][5]).toBeUndefined();

    expect(table.rows[1][0]).toBe(time);
    expect(table.rows[1][1]).toBe('Label Value 3');
    expect(table.rows[1][2]).toBeUndefined();
    expect(table.rows[1][3]).toBeUndefined();
    expect(table.rows[1][4]).toBeUndefined();
    expect(table.rows[1][5]).toBe(7);
  });
});
