import { Location } from 'history';

import { locationService, setBackendSrv, BackendSrv } from '@grafana/runtime';
import { playlistSrv } from 'app/features/playlist/PlaylistSrv';

import { NewFrontendAssetsChecker } from './NewFrontendAssetsChecker';

describe('NewFrontendAssetsChecker', () => {
  const backendApiGet = jest.fn().mockReturnValue(Promise.resolve({}));
  const locationReload = jest.fn();

  const originalLocation = window.location;

  beforeAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: locationReload },
    });
  });

  afterAll(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  setBackendSrv({
    get: backendApiGet,
  } as unknown as BackendSrv);

  it('Should skip update checks if below interval', () => {
    const checker = new NewFrontendAssetsChecker();
    checker.start();

    locationService.push('/d/123');

    expect(backendApiGet).toHaveBeenCalledTimes(0);
  });

  it('Should do update check when changing dashboard or going home', async () => {
    const checker = new NewFrontendAssetsChecker(0);
    checker.start();

    locationService.push('/d/asd');
    locationService.push('/d/other');
    locationService.push('/d/other?viewPanel=2');
    locationService.push('/ignored');
    locationService.push('/ignored?asd');
    locationService.push('/ignored/sub');
    locationService.push('/home');

    expect(backendApiGet).toHaveBeenCalledTimes(2);
  });

  it('should skip reloading if we are playing a playlist', () => {
    const checker = new NewFrontendAssetsCheckerExposedLocationUpdate();
    const reloadMock = jest.fn();
    checker.reloadIfUpdateDetected = reloadMock;
    playlistSrv.state.isPlaying = true;
    checker.doLocationUpdated({ hash: 'foo', pathname: '/d/dashboarduid', state: {}, search: '' });
    expect(reloadMock).not.toHaveBeenCalled();
    playlistSrv.state.isPlaying = false;
  });

  it('should reload if we are accessing a dashboard', () => {
    const checker = new NewFrontendAssetsCheckerExposedLocationUpdate();
    const reloadMock = jest.fn();
    checker.reloadIfUpdateDetected = reloadMock;
    checker.doLocationUpdated({ hash: 'foo', pathname: '/d/dashboarduid', state: {}, search: '' });
    expect(reloadMock).toHaveBeenCalled();
  });
});

class NewFrontendAssetsCheckerExposedLocationUpdate extends NewFrontendAssetsChecker {
  public doLocationUpdated(location: Location) {
    this.locationUpdated(location);
  }
}
