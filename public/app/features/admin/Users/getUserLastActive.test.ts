import { getUserLastActive } from './getUserLastActive';

it.each([
  {
    name: 'last seen before account creation',
    user: { lastSeenAt: '2026-10-01', created: '2026-10-02', lastSeenAtAge: '5 days' },
    expected: { text: 'Never', neverLoggedIn: true },
  },
  {
    name: 'last seen after account creation',
    user: { lastSeenAt: '2026-10-02', created: '2026-10-01', lastSeenAtAge: '4 days' },
    expected: { text: '4 days', neverLoggedIn: false },
  },
  {
    name: 'last seen at account creation',
    user: { lastSeenAt: '2026-10-02', created: '2026-10-02', lastSeenAtAge: '4 days' },
    expected: { text: '4 days', neverLoggedIn: false },
  },
  {
    name: 'missing age even when last seen predates account creation',
    user: { lastSeenAt: '2026-10-01', created: '2026-10-02' },
    expected: { text: '', neverLoggedIn: false },
  },
  {
    name: 'missing creation date',
    user: { lastSeenAt: '2026-10-02', lastSeenAtAge: '4 days' },
    expected: { text: '4 days', neverLoggedIn: false },
  },
  {
    name: 'missing last-seen date',
    user: { created: '2026-10-02', lastSeenAtAge: '4 days' },
    expected: { text: '4 days', neverLoggedIn: false },
  },
])('formats last activity for $name', ({ user, expected }) => {
  expect(getUserLastActive(user)).toEqual(expected);
});
