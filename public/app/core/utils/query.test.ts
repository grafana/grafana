import { DataQuery } from '@grafana/data';
import { getNextRefIdChar } from './query';

const dataQueries: DataQuery[] = [
  {
    refId: 'A',
  },
  {
    refId: 'B',
  },
  {
    refId: 'C',
  },
  {
    refId: 'D',
  },
  {
    refId: 'E',
  },
];

describe('Get next refId char', () => {
  it('should return next char', () => {
    expect(getNextRefIdChar(dataQueries)).toEqual('F');
  });

  it('should get first char', () => {
    expect(getNextRefIdChar([])).toEqual('A');
  });
});
