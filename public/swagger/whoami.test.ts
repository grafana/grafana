import { loadWhoAmI, whoamiURL } from './whoami';

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

it('returns neither namespace nor user when the request is rejected', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(whoami({ message: 'Unauthorized' }, { status: 401 }));

  const result = await loadWhoAmI();

  expect(result).toEqual({});
});
