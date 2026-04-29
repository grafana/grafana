import { type Page } from '@playwright/test';

// Mirror of selectors.components.NavToolbar.commandPaletteTrigger from
// packages/grafana-e2e-selectors. Hardcoded because the smoke runner runs as a
// plain Node process and the workspace package isn't built into node_modules.
export const COMMAND_PALETTE_TRIGGER = 'data-testid Command palette trigger';

export type TypingPattern = 'burst' | 'normal' | 'thinking' | 'hunting';
export type ActivationStyle = 'mouse' | 'keyboard-immediate' | 'keyboard-browse';

export async function openCommandPalette(page: Page): Promise<void> {
  // Click the canonical trigger button (more reliable than the keyboard shortcut
  // across focus contexts). Selector imported from @grafana/e2e-selectors so we
  // pick up any future renames automatically.
  await page.getByTestId(COMMAND_PALETTE_TRIGGER).click();
  // KBar's search input renders with role="combobox" (see KBarSearch.tsx).
  await page.getByRole('combobox').waitFor({ state: 'visible', timeout: 5_000 });
}

export function jitter(n: number): number {
  return Math.random() * n;
}

export function pickTypingPattern(): TypingPattern {
  const r = Math.random();
  if (r < 0.3) {
    return 'burst';
  }
  if (r < 0.7) {
    return 'normal';
  }
  if (r < 0.9) {
    return 'thinking';
  }
  return 'hunting';
}

export function pickActivationStyle(): ActivationStyle {
  const r = Math.random();
  if (r < 0.4) {
    return 'mouse';
  }
  if (r < 0.7) {
    return 'keyboard-immediate';
  }
  return 'keyboard-browse';
}

/**
 * Type a query with a human-shaped cadence so the search_query telemetry sees
 * realistic timing and the occasional typo+correction. Always pads with 700ms
 * after typing so the 500ms debounce flushes.
 */
export async function humanType(page: Page, text: string, pattern: TypingPattern = pickTypingPattern()): Promise<void> {
  switch (pattern) {
    case 'burst':
      await page.keyboard.type(text, { delay: 40 + jitter(20) });
      break;
    case 'normal':
      await page.keyboard.type(text, { delay: 80 + jitter(40) });
      break;
    case 'thinking': {
      const split = Math.floor(text.length / 2);
      await page.keyboard.type(text.slice(0, split), { delay: 100 + jitter(80) });
      await page.waitForTimeout(500 + jitter(1000));
      await page.keyboard.type(text.slice(split), { delay: 100 + jitter(80) });
      break;
    }
    case 'hunting': {
      // Pick a non-terminal index to fat-finger, then correct.
      const idx = text.length > 1 ? Math.floor(Math.random() * (text.length - 1)) : 0;
      await page.keyboard.type(text.slice(0, idx), { delay: 80 + jitter(40) });
      const wrong = String.fromCodePoint((text.codePointAt(idx) ?? 97) + 1);
      await page.keyboard.type(wrong, { delay: 80 + jitter(40) });
      await page.waitForTimeout(150);
      await page.keyboard.press('Backspace');
      await page.keyboard.type(text.slice(idx), { delay: 80 + jitter(40) });
      break;
    }
  }
  await page.waitForTimeout(700);
}

export async function activate(page: Page, style: ActivationStyle = pickActivationStyle()): Promise<void> {
  switch (style) {
    case 'mouse':
      await page.getByRole('option').first().click();
      return;
    case 'keyboard-immediate':
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      return;
    case 'keyboard-browse': {
      const downs = 1 + Math.floor(Math.random() * 4);
      for (let i = 0; i < downs; i++) {
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(150 + jitter(200));
      }
      if (Math.random() < 0.3) {
        const ups = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < ups; i++) {
          await page.keyboard.press('ArrowUp');
          await page.waitForTimeout(150 + jitter(200));
        }
      }
      await page.keyboard.press('Enter');
      return;
    }
  }
}

export function pickQuery(scenario: string, variants: Record<string, string[]>): string {
  const list = variants[scenario];
  return list[Math.floor(Math.random() * list.length)];
}
