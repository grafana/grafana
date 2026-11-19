import { contextSrv } from 'app/core/services/context_srv';

/**
 * Signs in the user whose stars the mock server serves `beforeEach` test, and restores the previous user `afterEach`
 * test. Stars are only read and written for a signed-in user with a uid.
 */
export const testWithStarsUser = () => {
  let replaced: Array<{ restore: () => void }> = [];

  beforeEach(() => {
    replaced = [
      jest.replaceProperty(contextSrv, 'isSignedIn', true),
      jest.replaceProperty(contextSrv.user, 'uid', 'u000000001'),
    ];
  });

  afterEach(() => {
    replaced.forEach((property) => property.restore());
  });
};
