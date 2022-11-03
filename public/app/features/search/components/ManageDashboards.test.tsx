import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { FolderDTO } from 'app/types';

import ManageDashboardsNew from './ManageDashboardsNew';

jest.mock('app/core/services/context_srv', () => {
  const originMock = jest.requireActual('app/core/services/context_srv');

  return {
    ...originMock,
    contextSrv: {
      ...originMock.context_srv,
      user: {},
      hasAccess: jest.fn(() => false),
    },
  };
});

const setup = async (options?: { folder?: FolderDTO }) => {
  const { folder = {} as FolderDTO } = options || {};
  const store = configureStore();

  const { rerender } = await waitFor(() =>
    render(
      <Provider store={store}>
        <ManageDashboardsNew folder={folder} />
      </Provider>
    )
  );

  return { rerender, store };
};

jest.spyOn(console, 'error').mockImplementation();

describe('ManageDashboards', () => {
  beforeEach(() => {
    (contextSrv.hasAccess as jest.Mock).mockClear();
  });
  it("should hide and show dashboard actions based on user's permissions", async () => {
    (contextSrv.hasAccess as jest.Mock).mockReturnValue(false);

    const { rerender, store } = await setup();

    expect(screen.queryByRole('button', { name: /new/i })).not.toBeInTheDocument();

    (contextSrv.hasAccess as jest.Mock).mockReturnValue(true);
    await waitFor(() =>
      rerender(
        <Provider store={store}>
          <ManageDashboardsNew folder={{ canEdit: true } as FolderDTO} />
        </Provider>
      )
    );

    expect(screen.getByRole('button', { name: /new/i })).toBeInTheDocument();
  });
});
