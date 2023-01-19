import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { contextSrv } from 'app/core/services/context_srv';
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

  const { rerender } = await waitFor(() => render(<ManageDashboardsNew folder={folder} />));

  return { rerender };
};

jest.spyOn(console, 'error').mockImplementation();

describe('ManageDashboards', () => {
  beforeEach(() => {
    (contextSrv.hasAccess as jest.Mock).mockClear();
  });

  it("should hide and show dashboard actions based on user's permissions", async () => {
    (contextSrv.hasAccess as jest.Mock).mockReturnValue(false);

    const { rerender } = await setup();

    expect(screen.queryByRole('button', { name: /new/i })).not.toBeInTheDocument();

    (contextSrv.hasAccess as jest.Mock).mockReturnValue(true);
    await waitFor(() => rerender(<ManageDashboardsNew folder={{ canEdit: true } as FolderDTO} />));

    expect(screen.getByRole('button', { name: /new/i })).toBeInTheDocument();
  });
});
