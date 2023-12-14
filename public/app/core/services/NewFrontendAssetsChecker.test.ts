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
  } as any as BackendSrv);

  it('Should skip update checks if below interval', () => {
    const checker = new NewFrontendAssetsChecker();
    checker.start();

    locationService.push('/d/123');

    expect(backendApiGet).toHaveBeenCalledTimes(0);
  });

  it('Should do update check when changing section and last check was greater than interval ago', async () => {
    const checker = new NewFrontendAssetsChecker(5);
    checker.start();

    locationService.push('/admin');

    expect(backendApiGet).toHaveBeenCalledTimes(0);

    await new Promise((resolve) => setTimeout(resolve, 10));

    locationService.push('/alerting');

    expect(backendApiGet).toHaveBeenCalledTimes(1);
  });
});
