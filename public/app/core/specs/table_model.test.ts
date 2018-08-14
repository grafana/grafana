import TableModel from 'app/core/table_model';

describe('when sorting table desc', () => {
  var table;
  var panel = {
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
  var table;
  var panel = {
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
  var table;
  var values;

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
