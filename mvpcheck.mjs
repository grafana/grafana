import { chromium } from '@playwright/test';

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1500, height: 950 }, colorScheme: 'dark' });
p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2500);
if (await p.locator('input[name="user"]').count()) {
  await p.fill('input[name="user"]', 'admin');
  await p.fill('input[name="password"]', 'admin');
  await p.click('button[type="submit"]');
  await p.waitForTimeout(4000);
}
await p.goto('http://localhost:3000/coauthor-mvp', { waitUntil: 'domcontentloaded' });
await p.waitForSelector('textarea', { timeout: 90000 });
await p.waitForTimeout(1000);
const pop = p.locator('[data-coauthor-popover]');
const bar = p.locator('[data-coauthor-toolbar]');
const ta = p.locator('textarea').first();
const backdrop = p.locator('div[aria-hidden="true"]').first();
const flat = (s) => s.replace(/\n/g, ' | ');
const box = await ta.boundingBox();
const y = box.y + 24;
const drag = async () => {
  await p.mouse.move(box.x + 320, y);
  await p.mouse.down();
  await p.mouse.move(box.x + 640, y, { steps: 8 });
  await p.mouse.up();
  await p.waitForTimeout(400);
};

await drag();
console.log('toolbar:', flat(await bar.innerText()));
console.log('  has Query map:', (await bar.innerText()).includes('Query map'));
await p.screenshot({ path: '/tmp/mvp-1-toolbar.png' });

await p.keyboard.press('Meta+/');
await p.waitForTimeout(1300);
console.log('coauthor open:', flat(await pop.innerText()));
console.log('  chips present:', (await pop.innerText()).includes('Swap function'));
await p.screenshot({ path: '/tmp/mvp-2-prompt.png' });

await pop.locator('input').fill('smooth this out so it is less jumpy');
await p.keyboard.press('Enter');
await p.waitForTimeout(700);
console.log('building:', flat(await pop.innerText()));
await p.waitForTimeout(1900);
console.log('result:', flat(await pop.innerText()));
console.log('  has pager:', (await pop.innerText()).includes(' of '), '| has Insert:', (await pop.innerText()).includes('Insert'));
console.log('  flow viz nodes:', await pop.locator('div').filter({ hasText: /^(FUNCTION|COUNTER)$/ }).count());
console.log('  pending edit:', (await backdrop.innerText()).includes('[15m]'), '| textarea still 5m:', (await ta.inputValue()).includes('[5m]'));
await p.screenshot({ path: '/tmp/mvp-3-result.png' });

// thumbs → modal
await pop.locator('button[aria-label="Good suggestion"]').click();
await p.waitForTimeout(600);
console.log('feedback modal:', await p.locator('[role="dialog"]').count());
await p.locator('[role="dialog"] button', { hasText: 'Cancel' }).click();
await p.waitForTimeout(300);

// chat → assistant sidebar
await pop.locator('button', { hasText: 'Chat' }).click();
await p.waitForTimeout(700);
console.log('assistant open:', await p.locator('[data-coauthor-assistant]').count());
console.log('  assistant text:', flat(await p.locator('[data-coauthor-assistant]').innerText()).slice(0, 160));
console.log('  popover still open:', await pop.count());
await p.screenshot({ path: '/tmp/mvp-4-chat.png' });

// accept
await pop.locator('button', { hasText: 'Accept' }).click();
await p.waitForTimeout(500);
console.log('accepted:', (await ta.inputValue()).slice(30, 90));
console.log('  popover closed:', (await pop.count()) === 0);
await b.close();
