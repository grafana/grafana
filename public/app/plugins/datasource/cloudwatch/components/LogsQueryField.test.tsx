import { render, screen, waitFor } from '@testing-library/react';
import _, { DebouncedFunc } from 'lodash'; // eslint-disable-line lodash/import-scope
import React from 'react';

import { ExploreId } from '../../../../types';
import { setupMockedDataSource } from '../__mocks__/CloudWatchDataSource';

import CloudWatchLogsQueryField from './LogsQueryField';

jest
  .spyOn(_, 'debounce')
  .mockImplementation((func: (...args: any) => any, wait?: number) => func as DebouncedFunc<typeof func>);

describe('CloudWatchLogsQueryField', () => {
  it('loads defaultLogGroups', async () => {
    const onRunQuery = jest.fn();
    const ds = setupMockedDataSource();
    ds.datasource.logsQueryRunner.defaultLogGroups = ['foo'];

    render(
      <CloudWatchLogsQueryField
        absoluteRange={{ from: 1, to: 10 }}
        exploreId={ExploreId.left}
        datasource={ds.datasource}
        query={{} as any}
        onRunQuery={onRunQuery}
        onChange={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('foo')).toBeInTheDocument();
    });
  });
});
