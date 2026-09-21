import { includeEndpoint } from './lib';

describe('includeEndpoint', () => {
  it('keeps everything but the per-kind search and trash routes, like the clients in this package', () => {
    expect(includeEndpoint('/')).toBe(true);
    expect(includeEndpoint('/app/instance')).toBe(true);
    expect(includeEndpoint('/testresources')).toBe(true);
    expect(includeEndpoint('/testresources/{name}/status')).toBe(true);
    expect(includeEndpoint('/testresources/{name}/bar')).toBe(true);
    expect(includeEndpoint('/testresources/search')).toBe(false);
    expect(includeEndpoint('/testresources/trash')).toBe(false);
    expect(includeEndpoint('/apis/g/v1/clusterkinds/search')).toBe(false);
    expect(includeEndpoint('/apis/g/v1/clusterkinds/{name}')).toBe(true);
  });
});
