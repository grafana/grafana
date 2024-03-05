import { locationService, setBackendSrv, BackendSrv } from '@grafana/runtime';

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
});
