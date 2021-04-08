import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { ApiKeysPageUnconnected, Props } from './ApiKeysPage';
import { ApiKey, OrgRole } from 'app/types';
import { NavModel } from '@grafana/data';
import { setSearchQuery } from './state/reducers';
import { mockToolkitActionCreator } from '../../../test/core/redux/mocks';
import { getMultipleMockKeys } from './__mocks__/apiKeysMock';
import { selectors } from '@grafana/e2e-selectors';
import userEvent from '@testing-library/user-event';
import { silenceConsoleOutput } from '../../../test/core/utils/silenceConsoleOutput';

const setup = (propOverrides: Partial<Props>) => {
  const loadApiKeysMock = jest.fn();
  const deleteApiKeyMock = jest.fn();
  const addApiKeyMock = jest.fn();
  const setSearchQueryMock = mockToolkitActionCreator(setSearchQuery);
  const props: Props = {
    navModel: {
      main: {
        text: 'Configuration',
      },
      node: {
        text: 'Api Keys',
      },
    } as NavModel,
    apiKeys: [] as ApiKey[],
    searchQuery: '',
    hasFetched: false,
    loadApiKeys: loadApiKeysMock,
    deleteApiKey: deleteApiKeyMock,
    setSearchQuery: setSearchQueryMock,
    addApiKey: addApiKeyMock,
    apiKeysCount: 0,
    timeZone: 'utc',
  };

  Object.assign(props, propOverrides);

  const { rerender } = render(<ApiKeysPageUnconnected {...props} />);
  return { rerender, props, loadApiKeysMock, setSearchQueryMock, deleteApiKeyMock, addApiKeyMock };
};

describe('ApiKeysPage', () => {
  silenceConsoleOutput();
  describe('when mounted', () => {
    it('then it should call loadApiKeys without expired', () => {
      const { loadApiKeysMock } = setup({});
      expect(loadApiKeysMock).toHaveBeenCalledTimes(1);
      expect(loadApiKeysMock).toHaveBeenCalledWith(false);
    });
  });

  describe('when loading', () => {
    it('then should show Loading message', () => {
      setup({ hasFetched: false });
      expect(screen.getByText(/loading \.\.\./i)).toBeInTheDocument();
    });
  });

  describe('when there are no API keys', () => {
    it('then it should render CTA', () => {
      setup({ apiKeys: getMultipleMockKeys(0), apiKeysCount: 0, hasFetched: true });
      expect(screen.getByLabelText(selectors.components.CallToActionCard.button('New API Key'))).toBeInTheDocument();
    });
  });

  describe('when there are API keys', () => {
    it('then it should render API keys table', async () => {
      const apiKeys = [
        { id: 1, name: 'First', role: OrgRole.Admin, secondsToLive: 60, expiration: '2021-01-01' },
        { id: 2, name: 'Second', role: OrgRole.Editor, secondsToLive: 60, expiration: '2021-01-02' },
        { id: 3, name: 'Third', role: OrgRole.Viewer, secondsToLive: 0, expiration: undefined },
      ];
      setup({ apiKeys, apiKeysCount: apiKeys.length, hasFetched: true });
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('row').length).toBe(4);
      expect(screen.getByRole('row', { name: /first admin 2021-01-01 00:00:00 cancel delete/i })).toBeInTheDocument();
      expect(screen.getByRole('row', { name: /second editor 2021-01-02 00:00:00 cancel delete/i })).toBeInTheDocument();
      expect(screen.getByRole('row', { name: /third viewer no expiration date cancel delete/i })).toBeInTheDocument();
    });
  });

  describe('when a user toggles the Show expired toggle', () => {
    it('then it should call loadApiKeys with correct parameters', async () => {
      const apiKeys = getMultipleMockKeys(3);
      const { loadApiKeysMock } = setup({ apiKeys, apiKeysCount: apiKeys.length, hasFetched: true });

      loadApiKeysMock.mockClear();
      toggleShowExpired();
      expect(loadApiKeysMock).toHaveBeenCalledTimes(1);
      expect(loadApiKeysMock).toHaveBeenCalledWith(true);

      loadApiKeysMock.mockClear();
      toggleShowExpired();
      expect(loadApiKeysMock).toHaveBeenCalledTimes(1);
      expect(loadApiKeysMock).toHaveBeenCalledWith(false);
    });
  });

  describe('when a user searches for an api key', () => {
    it('then it should dispatch setSearchQuery with correct parameters', async () => {
      const apiKeys = getMultipleMockKeys(3);
      const { setSearchQueryMock } = setup({ apiKeys, apiKeysCount: apiKeys.length, hasFetched: true });

      setSearchQueryMock.mockClear();
      expect(screen.getByPlaceholderText(/search keys/i)).toBeInTheDocument();
      await userEvent.type(screen.getByPlaceholderText(/search keys/i), 'First');
      expect(setSearchQueryMock).toHaveBeenCalledTimes(5);
    });
  });

  describe('when a user deletes an api key', () => {
    it('then it should dispatch deleteApi with correct parameters', async () => {
      const apiKeys = [
        { id: 1, name: 'First', role: OrgRole.Admin, secondsToLive: 60, expiration: '2021-01-01' },
        { id: 2, name: 'Second', role: OrgRole.Editor, secondsToLive: 60, expiration: '2021-01-02' },
        { id: 3, name: 'Third', role: OrgRole.Viewer, secondsToLive: 0, expiration: undefined },
      ];
      const { deleteApiKeyMock } = setup({ apiKeys, apiKeysCount: apiKeys.length, hasFetched: true });
      const firstRow = screen.getByRole('row', { name: /first admin 2021-01-01 00:00:00 cancel delete/i });
      const secondRow = screen.getByRole('row', { name: /second editor 2021-01-02 00:00:00 cancel delete/i });

      deleteApiKeyMock.mockClear();
      expect(within(firstRow).getByRole('cell', { name: /cancel delete/i })).toBeInTheDocument();
      userEvent.click(within(firstRow).getByRole('cell', { name: /cancel delete/i }));
      expect(within(firstRow).getByRole('button', { name: /delete/i })).toBeInTheDocument();
      userEvent.click(within(firstRow).getByRole('button', { name: /delete/i }));
      expect(deleteApiKeyMock).toHaveBeenCalledTimes(1);
      expect(deleteApiKeyMock).toHaveBeenCalledWith(1, false);

      toggleShowExpired();

      deleteApiKeyMock.mockClear();
      expect(within(secondRow).getByRole('cell', { name: /cancel delete/i })).toBeInTheDocument();
      userEvent.click(within(secondRow).getByRole('cell', { name: /cancel delete/i }));
      expect(within(secondRow).getByRole('button', { name: /delete/i })).toBeInTheDocument();
      userEvent.click(within(secondRow).getByRole('button', { name: /delete/i }));
      expect(deleteApiKeyMock).toHaveBeenCalledTimes(1);
      expect(deleteApiKeyMock).toHaveBeenCalledWith(2, true);
    });
  });

  describe('when a user adds an api key from CTA', () => {
    it('then it should call addApiKey with correct parameters', async () => {
      const apiKeys: any[] = [];
      const { addApiKeyMock } = setup({ apiKeys, apiKeysCount: apiKeys.length, hasFetched: true });

      addApiKeyMock.mockClear();
      userEvent.click(screen.getByLabelText(selectors.components.CallToActionCard.button('New API Key')));
      await addAndVerifyApiKey(addApiKeyMock, false);
    });
  });

  describe('when a user adds an api key from Add Api Key', () => {
    it('then it should call addApiKey with correct parameters', async () => {
      const apiKeys = getMultipleMockKeys(1);
      const { addApiKeyMock } = setup({ apiKeys, apiKeysCount: apiKeys.length, hasFetched: true });

      addApiKeyMock.mockClear();
      userEvent.click(screen.getByRole('button', { name: /add api key/i }));
      await addAndVerifyApiKey(addApiKeyMock, false);

      toggleShowExpired();

      addApiKeyMock.mockClear();
      userEvent.click(screen.getByRole('button', { name: /add api key/i }));
      await addAndVerifyApiKey(addApiKeyMock, true);
    });
  });

  describe('when a user adds an api key with an invalid expiration', () => {
    it('then it should display a message', async () => {
      const apiKeys = getMultipleMockKeys(1);
      const { addApiKeyMock } = setup({ apiKeys, apiKeysCount: apiKeys.length, hasFetched: true });

      addApiKeyMock.mockClear();
      userEvent.click(screen.getByRole('button', { name: /add api key/i }));
      await userEvent.type(screen.getByPlaceholderText(/name/i), 'Test');
      await userEvent.type(screen.getByPlaceholderText(/1d/i), '60x');
      expect(screen.queryByText(/not a valid duration/i)).not.toBeInTheDocument();
      userEvent.click(screen.getByRole('button', { name: /^add$/i }));
      expect(screen.getByText(/not a valid duration/i)).toBeInTheDocument();
      expect(addApiKeyMock).toHaveBeenCalledTimes(0);
    });
  });
});

function toggleShowExpired() {
  expect(screen.getByText(/show expired/i)).toBeInTheDocument();
  userEvent.click(screen.getByText(/show expired/i));
}

async function addAndVerifyApiKey(addApiKeyMock: jest.Mock, includeExpired: boolean) {
  expect(screen.getByRole('heading', { name: /add api key/i })).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/name/i)).toBeInTheDocument();
  expect(screen.getByRole('combobox')).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/1d/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^add$/i })).toBeInTheDocument();

  await userEvent.type(screen.getByPlaceholderText(/name/i), 'Test');
  await userEvent.type(screen.getByPlaceholderText(/1d/i), '60s');
  userEvent.click(screen.getByRole('button', { name: /^add$/i }));
  expect(addApiKeyMock).toHaveBeenCalledTimes(1);
  expect(addApiKeyMock).toHaveBeenCalledWith(
    { name: 'Test', role: 'Viewer', secondsToLive: 60 },
    expect.anything(),
    includeExpired
  );
}
