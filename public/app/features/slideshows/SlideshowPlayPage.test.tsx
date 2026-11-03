import { waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { of } from 'rxjs';
import { render } from 'test/test-utils';

import { createFetchResponse } from '../../../test/helpers/createFetchResponse';
import { backendSrv } from '../../core/services/backend_srv';
import { playlistSrv } from '../playlist/PlaylistSrv';

import SlideshowPlayPage from './SlideshowPlayPage';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

const slideshow = {
  metadata: { name: 'noc-wall' },
  spec: { title: 'NOC wall', interval: '5m', items: [{ group: 'g', resource: 'r', name: 'n' }] },
};

describe('SlideshowPlayPage', () => {
  it('starts the slideshow named in the route once it has loaded', async () => {
    jest.spyOn(backendSrv, 'fetch').mockImplementation(() => of(createFetchResponse(slideshow)));
    const start = jest.spyOn(playlistSrv, 'startSlideshow').mockResolvedValue();

    render(
      <Routes>
        <Route path="/slideshows/play/:uid" element={<SlideshowPlayPage />} />
      </Routes>,
      { historyOptions: { initialEntries: ['/slideshows/play/noc-wall'] } }
    );

    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ metadata: { name: 'noc-wall' } }));
    expect(backendSrv.fetch).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringMatching(/\/slideshows\/noc-wall$/) })
    );
  });
});
