import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import _, { DebouncedFunc } from 'lodash'; // eslint-disable-line lodash/import-scope
import React from 'react';
import { act } from 'react-dom/test-utils';

import { ExploreId } from '../../../../types';
import { setupMockedDataSource } from '../__mocks__/CloudWatchDataSource';

import CloudWatchLogsQueryField from './LogsQueryField';

jest
  .spyOn(_, 'debounce')
  .mockImplementation((func: (...args: any) => any, wait?: number) => func as DebouncedFunc<typeof func>);

describe('CloudWatchLogsQueryField', () => {
  it('runs onRunQuery on blur of Log Groups', async () => {
    const onRunQuery = jest.fn();
    const ds = setupMockedDataSource();

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

    const multiSelect = screen.getByLabelText('Log Groups');
    await act(async () => {
      fireEvent.blur(multiSelect);
    });
    expect(onRunQuery).toHaveBeenCalled();
  });

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
