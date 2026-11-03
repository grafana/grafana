import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { of, throwError } from 'rxjs';
import { render } from 'test/test-utils';

import { locationService, registerPlaylistItemKind } from '@grafana/runtime';
import { resetPlaylistItemKindsForTests } from '@grafana/runtime/internal';

import { createFetchResponse } from '../../../test/helpers/createFetchResponse';
import { backendSrv } from '../../core/services/backend_srv';

import SlideshowEditPage from './SlideshowEditPage';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

const refusal = {
  status: 500,
  data: {
    message:
      "this service's token has no delegated permission for the resource: collections.grafana.app/slideshows:create",
  },
};

const stored = {
  apiVersion: 'collections.grafana.app/v1alpha1',
  kind: 'Slideshow',
  metadata: { name: 'wall' },
  spec: {
    title: 'NOC wall',
    interval: '5m',
    items: [{ group: 'dashboard.grafana.app', resource: 'dashboards', name: 'cpu' }],
  },
};

function mockBackend(failWith?: unknown) {
  jest.spyOn(backendSrv, 'fetch').mockImplementation((options) => {
    if (options.method === 'POST' || options.method === 'PUT') {
      return failWith ? throwError(() => failWith) : of(createFetchResponse(stored));
    }
    return of(createFetchResponse(stored));
  });
}

function setup(path: string) {
  return render(
    <Routes>
      <Route path="/slideshows/new" element={<SlideshowEditPage />} />
      <Route path="/slideshows/edit/:uid" element={<SlideshowEditPage />} />
    </Routes>,
    { historyOptions: { initialEntries: [path] } }
  );
}

describe('SlideshowEditPage', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    resetPlaylistItemKindsForTests();
    registerPlaylistItemKind({
      group: 'dashboard.grafana.app',
      resource: 'dashboards',
      title: 'Dashboards',
      icon: 'apps',
      resolve: async () => ({ url: '/d/cpu', title: 'CPU overview' }),
      search: async () => [{ name: 'cpu', title: 'CPU overview' }],
    });
  });

  it('shows the server message and keeps the form when creating fails', async () => {
    mockBackend(refusal);
    const push = jest.spyOn(locationService, 'push').mockImplementation();
    const { user } = setup('/slideshows/new');

    await user.type(await screen.findByLabelText('Title'), 'My wall');
    await user.click(screen.getByRole('combobox', { name: 'Add' }));
    await user.click(await screen.findByText('CPU overview'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(refusal.data.message)).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('My wall');
    expect(screen.getByRole('textbox', { name: 'Interval for item 1' })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('shows the server message and keeps the form when updating fails', async () => {
    mockBackend({ status: 403, data: { message: 'not allowed to update this slideshow' } });
    const push = jest.spyOn(locationService, 'push').mockImplementation();
    const { user } = setup('/slideshows/edit/wall');

    const title = await screen.findByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Renamed');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('not allowed to update this slideshow')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Renamed');
    expect(push).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when the error has none', async () => {
    mockBackend({ status: 500, data: {} });
    const { user } = setup('/slideshows/edit/wall');

    await user.click(await screen.findByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Could not save the slideshow')).toBeInTheDocument();
  });

  it('clears the error and leaves the page when a retry succeeds', async () => {
    mockBackend(refusal);
    const push = jest.spyOn(locationService, 'push').mockImplementation();
    const { user } = setup('/slideshows/edit/wall');
    await user.click(await screen.findByRole('button', { name: 'Save' }));
    await screen.findByText(refusal.data.message);

    mockBackend();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/slideshows'));
    expect(screen.queryByText(refusal.data.message)).not.toBeInTheDocument();
  });
});
