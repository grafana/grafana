/** @jest-environment jsdom */

// The modified-link check relies on jsdom reporting attempted browser navigation.
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RouterStatusPage } from './RouterStatusPage';
import { cloudStatus } from './RouterStatusPage.testFixtures';

afterEach(() => {
  jest.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

// Clicks the link and reports whether the browser is left to follow it. jsdom cannot navigate, and says
// so, which is how a followed link shows up.
async function followed(el: HTMLElement, init: MouseEventInit) {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const notPrevented = fireEvent.click(el, init);
  // jsdom reports the navigation later; settle before judging, and before the next test
  await new Promise((resolve) => setTimeout(resolve, 0));
  const navigated = error.mock.calls.some(([e]) => String(e).includes('Not implemented: navigation'));
  error.mockRestore();
  return notPrevented && navigated;
}

it('links the tabs and sources, and leaves a modified click to the browser', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(cloudStatus)));
  render(<RouterStatusPage />);

  const sourcesTab = await screen.findByRole('tab', { name: /Sources/ });
  expect(sourcesTab).toHaveAttribute('href', '/?tab=sources');

  expect(await followed(sourcesTab, { metaKey: true })).toBe(true);
  expect(window.location.search).toBe('');
  expect(screen.getByRole('tab', { name: /Groups/ })).toHaveAttribute('aria-selected', 'true');

  await userEvent.click(sourcesTab);
  const link = within(screen.getAllByRole('row')[1]).getByRole('link');
  expect(await followed(link, { ctrlKey: true })).toBe(true);
  expect(window.location.search).toBe('?tab=sources');
});
