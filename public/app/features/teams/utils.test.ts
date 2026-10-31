import { webcrypto } from 'node:crypto';

import { contextSrv } from 'app/core/services/context_srv';

import { getTeamGravatarUrl } from './utils';

describe('getTeamGravatarUrl', () => {
  const originalGravatarUrl = contextSrv.user.gravatarUrl;

  beforeAll(() => {
    // jsdom has no crypto.subtle implementation
    if (!globalThis.crypto?.subtle) {
      Object.defineProperty(globalThis.crypto, 'subtle', { value: webcrypto.subtle });
    }
  });

  afterEach(() => {
    contextSrv.user.gravatarUrl = originalGravatarUrl;
  });

  it('builds an avatar URL from the sha256 hash of the email', async () => {
    expect(await getTeamGravatarUrl('foo@example.com', 'Team A')).toBe(
      '/avatar/321ba197033e81286fedb719d60d4ed5cecaed170733cb4a92013811afc0e3b6'
    );
  });

  it('falls back to a pseudo-email derived from the name when there is no email', async () => {
    // sha256 of 'teama@localhost'
    expect(await getTeamGravatarUrl('', 'Team A')).toBe(
      '/avatar/0a505a47cb01a74c2a3815e166dcf6dc78ef9ae7cf57f60cc1ace4a5dd16db46'
    );
  });

  it('returns the shared default profile image when gravatar is disabled on the server', async () => {
    // Not an image source — this is the URL the backend serves when gravatar is disabled.
    // eslint-disable-next-line @grafana/no-restricted-img-srcs
    const disabledGravatarUrl = '/grafana/public/img/user_profile.png';
    contextSrv.user.gravatarUrl = disabledGravatarUrl;

    expect(await getTeamGravatarUrl('foo@example.com', 'Team A')).toBe(disabledGravatarUrl);
  });

  it('returns undefined for a whitespace-only email', async () => {
    expect(await getTeamGravatarUrl('  ', '')).toBeUndefined();
  });
});
