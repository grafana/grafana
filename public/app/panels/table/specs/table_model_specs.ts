import {describe, beforeEach, it, sinon, expect} from 'test/lib/common';

import {TableModel} from '../table_model';

describe('when sorting table desc', () => {
  var table;
  var panel = {
    sort: {col: 0, desc: true},
  };

  beforeEach(() => {
    table = new TableModel();
    table.columns = [{}, {}];
    table.rows = [[100, 12], [105, 10], [103, 11]];
    table.sort(panel.sort);
  });

  it('should sort by time', () => {
    expect(table.rows[0][0]).to.be(105);
    expect(table.rows[1][0]).to.be(103);
    expect(table.rows[2][0]).to.be(100);
  });

  it ('should mark column being sorted', () => {
    expect(table.columns[0].sort).to.be(true);
    expect(table.columns[0].desc).to.be(true);
  });

});

describe('when sorting table asc', () => {
  var table;
  var panel = {
    sort: {col: 1, desc: false},
  };

  beforeEach(() => {
    table = new TableModel();
    table.columns = [{}, {}];
    table.rows = [[100, 11], [105, 15], [103, 10]];
    table.sort(panel.sort);
  });

  it('should sort by time', () => {
    expect(table.rows[0][1]).to.be(10);
    expect(table.rows[1][1]).to.be(11);
    expect(table.rows[2][1]).to.be(15);
  });

});

