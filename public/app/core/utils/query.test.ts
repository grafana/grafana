import { DataQuery } from '@grafana/data';
import { getNextRefIdChar } from './query';

function dataQueryHelper(ids: string[]): DataQuery[] {
  return ids.map((letter) => {
    return { refId: letter };
  });
}

const singleDataQuery: DataQuery[] = dataQueryHelper('ABCDE'.split(''));
const outOfOrderDataQuery: DataQuery[] = dataQueryHelper('ABD'.split(''));
const singleExtendedDataQuery: DataQuery[] = dataQueryHelper('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));

describe('Get next refId char', () => {
  it('should return next char', () => {
    expect(getNextRefIdChar(singleDataQuery)).toEqual('F');
  });

  it('should get first char', () => {
    expect(getNextRefIdChar([])).toEqual('A');
  });

  it('should get the first avaliable character if a query has been deleted out of order', () => {
    expect(getNextRefIdChar(outOfOrderDataQuery)).toEqual('C');
  });

  it('should append a new char and start from AA when Z is reached', () => {
    expect(getNextRefIdChar(singleExtendedDataQuery)).toEqual('AA');
  });
});
