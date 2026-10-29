import { type SceneQueryRunner } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';

import { type NotebookCellItem } from './NotebookCellItem';
import { applyQueries } from './applyQueries';
import { setQueryRunnerQueries } from './setQueryRunnerQueries';

jest.mock('./setQueryRunnerQueries');

const queries: DataQuery[] = [{ refId: 'A' }];

function buildCell() {
  return {
    onQueryChange: jest.fn(),
    onQueryStructureChange: jest.fn(),
  } as unknown as NotebookCellItem;
}

describe('applyQueries', () => {
  const queryRunner = {} as SceneQueryRunner;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls setQueryRunnerQueries directly when no cell is given', () => {
    applyQueries(undefined, queryRunner, queries);

    expect(setQueryRunnerQueries).toHaveBeenCalledWith(queryRunner, queries);
  });

  it('routes a coalesced edit through the cell when no label is given', () => {
    const cell = buildCell();

    applyQueries(cell, queryRunner, queries);

    expect(cell.onQueryChange).toHaveBeenCalledWith(queries);
    expect(cell.onQueryStructureChange).not.toHaveBeenCalled();
    expect(setQueryRunnerQueries).not.toHaveBeenCalled();
  });

  it('routes a discrete edit through the cell when a label is given', () => {
    const cell = buildCell();

    applyQueries(cell, queryRunner, queries, 'Add query');

    expect(cell.onQueryStructureChange).toHaveBeenCalledWith('Add query', queries);
    expect(cell.onQueryChange).not.toHaveBeenCalled();
    expect(setQueryRunnerQueries).not.toHaveBeenCalled();
  });
});
