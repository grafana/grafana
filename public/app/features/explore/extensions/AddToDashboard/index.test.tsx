import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { Provider } from 'react-redux';

import { setEchoSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { contextSrv } from 'app/core/services/context_srv';
import { Echo } from 'app/core/services/echo/Echo';
import { configureStore } from 'app/store/configureStore';
import { ExploreState } from 'app/types/explore';

import { createEmptyQueryResponse } from '../../state/utils';

import { AddToDashboard } from '.';

jest.mock('app/core/services/context_srv');

const mocks = {
  contextSrv: jest.mocked(contextSrv),
};

const setup = (children: ReactNode, queries: DataQuery[] = [{ refId: 'A' }]) => {
  const store = configureStore({
    explore: {
      panes: {
        left: {
          range: {
            from: 'now-6h',
            to: 'now',
            raw: { from: 'now-6h', to: 'now' },
          },
          queries,
          queryResponse: createEmptyQueryResponse(),
        },
      },
    } as unknown as ExploreState,
  });

  return render(<Provider store={store}>{children}</Provider>);
};

const openModal = async (nameOverride?: string) => {
  await userEvent.click(screen.getByRole('button', { name: /add to dashboard/i }));
  expect(await screen.findByRole('dialog', { name: nameOverride || 'Add panel to dashboard' })).toBeInTheDocument();
};

describe('AddToDashboardButton', () => {
  beforeAll(() => {
    setEchoSrv(new Echo());
  });

  beforeEach(() => {
    mocks.contextSrv.hasPermission.mockImplementation(() => true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Is disabled if explore pane has no queries', async () => {
    setup(<AddToDashboard exploreId={'left'} />, []);

    const button = await screen.findByRole('button', { name: /add to dashboard/i });
    expect(button).toBeDisabled();

    await userEvent.click(button);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('Success path', () => {
    afterEach(() => {
      jest.restoreAllMocks();
      mocks.contextSrv.hasPermission.mockImplementation(() => true);
    });

    it('Opens and closes the modal correctly', async () => {
      setup(<AddToDashboard exploreId={'left'} />);

      await openModal();

      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
