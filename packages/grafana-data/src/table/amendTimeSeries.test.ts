import { Table, amendTable } from './amendTimeSeries';

describe('amendTable', () => {
  it('should append nextTable when there is no overlap (nextTable after prevTable)', () => {
    const prevTable: Table = [
      [1, 2, 5],
      ['a', 'b', 'e'],
    ];
    const nextTable: Table = [
      [6, 7, 8],
      ['f', 'g', 'h'],
    ];
    const result = amendTable(prevTable, nextTable);
    expect(result).toEqual([
      [1, 2, 5, 6, 7, 8],
      ['a', 'b', 'e', 'f', 'g', 'h'],
    ]);
  });

  it('should prepend nextTable when there is no overlap (nextTable before prevTable)', () => {
    const prevTable: Table = [
      [3, 4, 5],
      ['c', 'd', 'e'],
    ];
    const nextTable: Table = [
      [1, 2],
      ['a', 'b'],
    ];
    const result = amendTable(prevTable, nextTable);
    expect(result).toEqual([
      [1, 2, 3, 4, 5],
      ['a', 'b', 'c', 'd', 'e'],
    ]);
  });

  it('should fully replace prevTable when nextTable covers entire range', () => {
    const prevTable: Table = [
      [3, 4, 5],
      ['c', 'd', 'e'],
    ];
    const nextTable: Table = [
      [1, 2, 3, 4, 5, 6],
      ['a', 'b', 'c', 'd', 'e', 'f'],
    ];
    const result = amendTable(prevTable, nextTable);
    expect(result).toEqual(nextTable);
  });

  it('should partially replace prevTable when nextTable is within range', () => {
    const prevTable: Table = [
      [1, 2, 3, 4, 5],
      ['a', 'b', 'c', 'd', 'e'],
    ];
    const nextTable: Table = [
      [3, 4],
      ['x', 'y'],
    ];
    const result = amendTable(prevTable, nextTable);
    expect(result).toEqual([
      [1, 2, 3, 4, 5],
      ['a', 'b', 'x', 'y', 'e'],
    ]);
  });

  it('should append nextTable with overlap', () => {
    const prevTable: Table = [
      [1, 2, 5],
      ['a', 'b', 'e'],
    ];
    const nextTable: Table = [
      [2, 3, 6],
      ['b', 'c', 'f'],
    ];
    const result = amendTable(prevTable, nextTable);
    expect(result).toEqual([
      [1, 2, 3, 6],
      ['a', 'b', 'c', 'f'],
    ]);
  });

  it('should prepend nextTable with overlap', () => {
    const prevTable: Table = [
      [3, 4, 5],
      ['c', 'd', 'e'],
    ];
    const nextTable: Table = [
      [1, 4],
      ['a', 'd'],
    ];
    const result = amendTable(prevTable, nextTable);
    expect(result).toEqual([
      [1, 4, 5],
      ['a', 'd', 'e'],
    ]);
  });

  it('should handle empty prevTable', () => {
    const prevTable: Table = [[]];
    const nextTable: Table = [
      [1, 2, 3],
      ['a', 'b', 'c'],
    ];
    const result = amendTable(prevTable, nextTable);
    expect(result).toEqual(nextTable);
  });

  it('should handle empty nextTable', () => {
    const prevTable: Table = [
      [1, 2, 3],
      ['a', 'b', 'c'],
    ];
    const nextTable: Table = [[]];
    const result = amendTable(prevTable, nextTable);
    expect(result).toEqual(prevTable);
  });

  it('should handle both tables being empty', () => {
    const prevTable: Table = [[]];
    const nextTable: Table = [[]];
    const result = amendTable(prevTable, nextTable);
    expect(result).toEqual([[]]);
  });
});
