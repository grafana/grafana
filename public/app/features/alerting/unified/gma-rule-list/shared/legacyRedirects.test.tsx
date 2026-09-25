import { type ReactElement } from 'react';
import { Navigate } from 'react-router-dom-v5-compat';
import { render, screen, waitFor } from 'test/test-utils';

import { LegacyRecentlyDeletedRedirect, LegacyRuleListRedirect } from './legacyRedirects';

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  Navigate: jest.fn(() => null),
}));

function renderAt(initialEntry: string, element: ReactElement) {
  return render(element, { historyOptions: { initialEntries: [initialEntry] } });
}

async function waitForNavigateTarget() {
  await waitFor(() => expect(jest.mocked(Navigate)).toHaveBeenCalled());
  const calls = jest.mocked(Navigate).mock.calls;
  return calls[calls.length - 1][0].to;
}

// NAV-1: `/alerting/list` and `/alerting/recently-deleted` redirect to the GMA-only pages once
// the stack flag is on. The full migration (type-based destination choice and legacy-param
// translation) runs before navigating, so a `type:` token is consumed rather than carried
// through to the destination's canonical search.
describe('LegacyRuleListRedirect', () => {
  afterEach(() => {
    jest.mocked(Navigate).mockClear();
  });

  it('shows a loading placeholder while the migration is in flight', async () => {
    renderAt('/alerting/list?search=cpu', <LegacyRuleListRedirect />);

    expect(screen.getByText('Redirecting...')).toBeInTheDocument();
    expect(Navigate).not.toHaveBeenCalled();

    // Let the in-flight migration settle before the test ends, so its state update lands
    // inside this test's act() scope rather than leaking into the next one.
    await waitForNavigateTarget();
  });

  it('redirects to Recording rules and drops the type token when the legacy search has type:recording', async () => {
    renderAt('/alerting/list?search=type%3Arecording%20cpu&view=list', <LegacyRuleListRedirect />);

    expect(await waitForNavigateTarget()).toBe('/alerting/rules/recording?search=cpu&view=list');
  });

  it('redirects to Alert rules when there is no type token', async () => {
    renderAt('/alerting/list?search=cpu', <LegacyRuleListRedirect />);

    expect(await waitForNavigateTarget()).toBe('/alerting/rules/alert?search=cpu');
  });

  it('redirects to Alert rules and drops the type token when type is explicitly alerting', async () => {
    renderAt('/alerting/list?search=type%3Aalerting%20cpu', <LegacyRuleListRedirect />);

    expect(await waitForNavigateTarget()).toBe('/alerting/rules/alert?search=cpu');
  });

  it('redirects to Alert rules with no query string at all', async () => {
    renderAt('/alerting/list', <LegacyRuleListRedirect />);

    expect(await waitForNavigateTarget()).toBe('/alerting/rules/alert');
  });
});

describe('LegacyRecentlyDeletedRedirect', () => {
  afterEach(() => {
    jest.mocked(Navigate).mockClear();
  });

  it('always redirects to the Alert rules Recently deleted tab', async () => {
    renderAt('/alerting/recently-deleted?foo=bar', <LegacyRecentlyDeletedRedirect />);

    expect(await waitForNavigateTarget()).toBe('/alerting/rules/alert/deleted?foo=bar');
  });
});
