import { DataQuery } from '@grafana/schema';

import { getNextRefId } from './refId';

export interface TestQuery extends DataQuery {
  name?: string;
}

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
    expect(getNextRefId(singleDataQuery)).toEqual('F');
  });

  it('should get first char', () => {
    expect(getNextRefId([])).toEqual('A');
  });

  it('should get the first available character if a query has been deleted out of order', () => {
    expect(getNextRefId(outOfOrderDataQuery)).toEqual('C');
  });

  it('should append a new char and start from AA when Z is reached', () => {
    expect(getNextRefId(singleExtendedDataQuery)).toEqual('AA');
  });
});
