import { screen } from '@testing-library/react';
import { of } from 'rxjs';
import { render } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { createFetchResponse } from '../../../test/helpers/createFetchResponse';
import { backendSrv } from '../../core/services/backend_srv';

import SlideshowsPage from './SlideshowsPage';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

const list = {
  kind: 'SlideshowList',
  apiVersion: 'collections.grafana.app/v1alpha1',
  metadata: {},
  items: [
    {
      metadata: { name: 'noc-wall' },
      spec: { title: 'NOC wall', interval: '5m', items: [] },
    },
  ],
};

describe('SlideshowsPage', () => {
  beforeEach(() => {
    jest.spyOn(backendSrv, 'fetch').mockImplementation(() => of(createFetchResponse(list)));
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    contextSrv.isEditor = true;
  });

  it('lists slideshows from the collections API', async () => {
    render(<SlideshowsPage />);

    expect(await screen.findByText('NOC wall')).toBeInTheDocument();
    expect(backendSrv.fetch).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining('/apis/collections.grafana.app/v1alpha1/namespaces/') })
    );
    expect(screen.getByRole('link', { name: 'Edit slideshow NOC wall' })).toHaveAttribute(
      'href',
      '/slideshows/edit/noc-wall'
    );
  });

  it('starts a slideshow at its play route from the start modal', async () => {
    const push = jest.spyOn(locationService, 'push').mockImplementation();
    const { user } = render(<SlideshowsPage />);

    await user.click(await screen.findByRole('button', { name: 'Start slideshow NOC wall' }));
    await user.click(screen.getByRole('radio', { name: /kiosk/i }));
    await user.click(screen.getByRole('button', { name: 'Start NOC wall' }));

    expect(push).toHaveBeenCalledWith('/slideshows/play/noc-wall?kiosk=true');
  });

  it('hides edit and delete from users who cannot write playlists', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
    contextSrv.isEditor = false;
    render(<SlideshowsPage />);

    expect(await screen.findByText('NOC wall')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /edit slideshow/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete slideshow/i })).not.toBeInTheDocument();
  });
});
