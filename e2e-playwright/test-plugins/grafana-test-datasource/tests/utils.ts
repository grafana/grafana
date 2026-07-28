import { Locator } from '@playwright/test';

import { expect } from '@grafana/plugin-e2e';

type IconStatus = 'ok' | 'decode-failed' | 'zero-size';

// Resolves once the <img> has settled. decode() rejects on a failed/404 load; the naturalWidth
// check covers the rare "decoded but no pixels" case. Needed because the plugin logos are SVGs
// with a viewBox but no intrinsic width/height. Awaiting decode() is the wait — no polling.
async function iconStatus(img: Locator): Promise<IconStatus> {
  return img.evaluate(async (el: HTMLImageElement): Promise<IconStatus> => {
    try {
      await el.decode();
    } catch {
      return 'decode-failed';
    }
    return el.naturalWidth > 0 ? 'ok' : 'zero-size';
  });
}

// First line of the card's text — the plugin/datasource name — falling back to its index.
async function cardLabel(card: Locator, index: number): Promise<string> {
  const text = await card.innerText().catch(() => '');
  return text.split('\n')[0].trim() || `card #${index}`;
}

// Asserts every card's <img> loaded. Checks all icons in a single pass and fails once with a
// list of every broken icon (plugin name + reason + src) — no expect.poll retry spam, and you
// see all failures rather than only the first. The non-empty guard stops a silently empty list
// from passing as a no-op.
export async function expectAllIconsLoaded(cards: Locator, min = 1): Promise<void> {
  const count = await cards.count();
  expect(count, `expected at least ${min} card(s) with an icon, found ${count}`).toBeGreaterThanOrEqual(min);

  const failures: string[] = [];
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const img = card.locator('img');
    const label = await cardLabel(card, i);
    const src = await img.getAttribute('src');
    const status = await iconStatus(img);
    if (status !== 'ok') {
      failures.push(`- "${label}": ${status} (src="${src}")`);
    }
  }

  expect(failures, `${failures.length} icon(s) failed to load:\n${failures.join('\n')}`).toEqual([]);
}
