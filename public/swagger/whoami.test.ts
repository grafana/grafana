import { bootdataURL, loadWhoAmI, whoamiURL } from './whoami';

function whoami(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), init);
}

afterEach(() => {
  jest.restoreAllMocks();
});

it('returns the namespace and user from a single whoami request', async () => {
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    whoami({
      identity: { type: 'user', name: 'u000000001' },
      displayName: 'Admin',
      email: 'admin@example.com',
      avatarURL: '/avatar/abc',
      namespace: 'default',
    })
  );

  const result = await loadWhoAmI();

  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith(whoamiURL);
  expect(result.namespace).toBe('default');
  expect(result.userView?.user).toEqual({ name: 'Admin', avatarUrl: '/avatar/abc' });
});

it.each([
  ['email when there is no display name', { email: 'sa@example.com' }, 'sa@example.com'],
  ['identity name when there is no display name or email', {}, 'sa-1'],
])('falls back to the %s', async (_, fields, name) => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      whoami({ identity: { type: 'service-account', name: 'sa-1' }, namespace: 'stacks-1', ...fields })
    );

  const result = await loadWhoAmI();

  expect(result.userView?.user.name).toBe(name);
});

it('keeps the namespace but shows no user for anonymous access', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      whoami({ identity: { type: 'anonymous', name: 'anonymous' }, displayName: 'Anonymous', namespace: 'default' })
    );

  const result = await loadWhoAmI();

  expect(result).toEqual({ namespace: 'default' });
});

const bootdata = {
  user: { isSignedIn: true, name: 'Admin', login: 'admin', email: 'admin@example.com', gravatarUrl: '/avatar/abc' },
  settings: { namespace: 'stacks-1' },
};

it.each([401, 500])('falls back to the user and namespace in the boot data when whoami returns %d', async (status) => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (url) =>
      url === whoamiURL ? whoami({ message: 'failed' }, { status }) : whoami(bootdata)
    );

  const result = await loadWhoAmI();

  expect(fetch).toHaveBeenCalledWith(bootdataURL);
  expect(result.namespace).toBe('stacks-1');
  expect(result.userView?.user).toEqual({ name: 'Admin', avatarUrl: '/avatar/abc' });
});

it('falls back to the boot data when the whoami request fails, and shows no user when signed out', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (url === whoamiURL) {
      throw new TypeError('network down');
    }
    return whoami({ user: { isSignedIn: false, name: '' }, settings: { namespace: 'default' } });
  });

  expect(await loadWhoAmI()).toEqual({ namespace: 'default' });
});

it('returns neither namespace nor user when whoami and the boot data are both rejected', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(globalThis, 'fetch').mockImplementation(async () => whoami({ message: 'failed' }, { status: 500 }));

  expect(await loadWhoAmI()).toEqual({});
});
