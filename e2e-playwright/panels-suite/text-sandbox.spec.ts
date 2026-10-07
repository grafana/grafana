import { expect, test } from '@playwright/test';
import { buildSync } from 'esbuild';
import path from 'node:path';

import type * as Sandbox from '../../public/app/plugins/panel/text/v2/sandboxFrame';

declare global {
  interface Window {
    textSandbox: typeof Sandbox;
    sandboxStates: Sandbox.TextSandboxState[];
    disposeSandbox?: () => void;
  }
}

const script = buildSync({
  entryPoints: [path.resolve(__dirname, '../../public/app/plugins/panel/text/v2/sandboxFrame.ts')],
  bundle: true,
  conditions: ['@grafana-app/source'],
  write: false,
  format: 'iife',
  globalName: 'textSandbox',
}).outputFiles[0].text;

test.describe('Text sandbox network boundary', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://grafana.test/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<div id="host"></div>' })
    );
    await page.goto('https://grafana.test/');
    await page.addScriptTag({ content: script });
  });

  test('blocks image requests before consent, recreates with approved origin, and blocks a new origin', async ({
    page,
    browserName,
  }) => {
    const requests: string[] = [];
    await page.route('https://external.test/**', (route) => {
      requests.push(route.request().url());
      return route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" />',
      });
    });
    await page.route('https://second.test/**', (route) => {
      requests.push(route.request().url());
      return route.abort();
    });
    const mount = (html: string, origins: string[]) =>
      page.evaluate(
        ({ html, origins }) => {
          window.disposeSandbox?.();
          window.sandboxStates = [];
          window.disposeSandbox = window.textSandbox.mountTextSandbox(document.getElementById('host')!, {
            html,
            css: '',
            title: 'Text panel content',
            policy: window.textSandbox.textSandboxPolicy(origins, '/public/fonts/'),
            onState: (state) => window.sandboxStates.push(state),
            onHeight: () => {},
          });
        },
        { html, origins }
      );

    await mount('<img src="https://external.test/collect?secret=first">', []);
    if (browserName === 'webkit') {
      await expect.poll(() => page.evaluate(() => window.sandboxStates.at(-1)?.status)).toBe('error');
      expect(requests).toEqual([]);
      return;
    }
    await expect
      .poll(() => page.evaluate(() => window.sandboxStates.at(-1)))
      .toEqual({
        status: 'blocked',
        resources: [{ directive: 'img-src', origin: 'https://external.test' }],
      });
    expect(requests).toEqual([]);
    await expect(page.getByTitle('Text panel content')).toHaveCount(0);

    await mount('<img src="https://external.test/collect?secret=first">', ['https://external.test']);
    await expect.poll(() => page.evaluate(() => window.sandboxStates.at(-1)?.status)).toBe('ready');
    await expect.poll(() => requests).toEqual(['https://external.test/collect?secret=first']);
    await expect(page.getByTitle('Text panel content')).toBeVisible();

    await page.evaluate(() => {
      const doc = document.querySelector('iframe')!.contentDocument!;
      const image = doc.createElement('img');
      image.src = 'https://second.test/collect?secret=later';
      doc.body.append(image);
    });
    await expect.poll(() => page.evaluate(() => window.sandboxStates.at(-1)?.status)).toBe('blocked');
    expect(requests).toEqual(['https://external.test/collect?secret=first']);
    await expect(page.getByTitle('Text panel content')).toHaveCount(0);
  });

  for (const [directive, html] of [
    ['frame-src', '<iframe src="https://external.test/embed?secret=value"></iframe>'],
    [
      'img-src',
      '<div style="height:20px;background-image:url(https://external.test/background?secret=value)">Content</div>',
    ],
  ]) {
    test(`blocks ${directive} resources without exposing the frame`, async ({ page, browserName }) => {
      const requests: string[] = [];
      await page.route('https://external.test/**', (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.evaluate((html) => {
        window.sandboxStates = [];
        window.disposeSandbox = window.textSandbox.mountTextSandbox(document.getElementById('host')!, {
          html,
          css: '',
          title: 'Text panel content',
          policy: window.textSandbox.textSandboxPolicy([], '/public/fonts/'),
          onState: (state) => window.sandboxStates.push(state),
          onHeight: () => {},
        });
      }, html);
      await expect
        .poll(() => page.evaluate(() => window.sandboxStates.at(-1)?.status))
        .toBe(browserName === 'webkit' ? 'error' : 'blocked');
      expect(requests).toEqual([]);
      expect(await page.evaluate(() => window.sandboxStates.some((state) => state.status === 'ready'))).toBe(false);
      await expect(page.getByTitle('Text panel content')).toHaveCount(0);
    });
  }

  test('reveals text only after callback verification and prevents scripts from running', async ({
    page,
    browserName,
  }) => {
    await page.evaluate(() => {
      window.sandboxStates = [];
      window.disposeSandbox = window.textSandbox.mountTextSandbox(document.getElementById('host')!, {
        html: '<p>Safe text</p><img src="data:image/png,invalid" onerror="parent.document.body.textContent = \'escaped\'">',
        css: '.markdown-html { color: rgb(1, 2, 3); }',
        title: 'Text panel content',
        policy: window.textSandbox.textSandboxPolicy([], '/public/fonts/'),
        onState: (state) => window.sandboxStates.push(state),
        onHeight: () => {},
      });
    });
    await expect
      .poll(() => page.evaluate(() => window.sandboxStates.at(-1)?.status))
      .toBe(browserName === 'webkit' ? 'error' : 'ready');
    if (browserName !== 'webkit') {
      await expect(page.frameLocator('iframe').getByText('Safe text')).toBeVisible();
      await expect(page.frameLocator('iframe').getByText('Safe text')).toHaveCSS('color', 'rgb(1, 2, 3)');
    }
    await expect(page.locator('#host')).toHaveCount(1);
  });
});
