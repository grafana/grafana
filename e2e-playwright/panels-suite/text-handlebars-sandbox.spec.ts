import { expect, test, type Page } from '@playwright/test';
import { rspack } from '@rspack/core';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { createTemplateSandbox } from './text-handlebars.fixture';

const root = path.resolve(__dirname, '../..');
const NONCE = 'sandbox-test-nonce';
let bundle: string;

declare global {
  interface Window {
    handlebarsSandbox: { createTemplateSandbox: typeof createTemplateSandbox };
    templateSession: ReturnType<typeof createTemplateSandbox>;
  }
}

test.beforeAll(async ({ browser }, testInfo) => {
  console.log(`${testInfo.project.name}: ${browser.version()}`);
  const output = mkdtempSync(path.join(os.tmpdir(), 'handlebars-rspack-'));
  try {
    await new Promise<void>((resolve, reject) => {
      const compiler = rspack({
        mode: 'production',
        context: root,
        resolve: { extensions: ['.ts', '.js'] },
        entry: './e2e-playwright/panels-suite/text-handlebars.fixture.ts',
        output: { path: output, filename: 'sandbox.js', library: { type: 'var', name: 'handlebarsSandbox' } },
        devtool: false,
        module: {
          rules: [
            {
              resourceQuery: /text-panel-runtime/,
              type: 'javascript/auto',
              use: path.join(root, 'scripts/rspack/loaders/textPanelRuntime.cjs'),
            },
            {
              test: /\.ts$/,
              resourceQuery: { not: [/text-panel-runtime/] },
              use: { loader: 'builtin:swc-loader', options: { jsc: { parser: { syntax: 'typescript' } } } },
            },
          ],
        },
      });
      compiler.run((error, stats) => {
        compiler.close((closeError) => {
          if (error || closeError || stats?.hasErrors()) {
            reject(error ?? closeError ?? new Error(stats!.toString({ all: false, errors: true })));
          } else {
            resolve();
          }
        });
      });
    });
    bundle = readFileSync(path.join(output, 'sandbox.js'), 'utf8');
    console.log(`Test parent + embedded runtime bundle: ${Buffer.byteLength(bundle)} bytes`);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});

async function openSandbox(page: Page, trustedTypes: boolean) {
  const csp = `default-src 'none'; script-src 'nonce-${NONCE}' 'strict-dynamic'; frame-src 'self'; connect-src 'none'; ${trustedTypes ? "require-trusted-types-for 'script'; trusted-types grafana-text-template-shell grafana-text-template;" : ''}`;
  await page.route('https://grafana.test/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      headers: { 'Content-Security-Policy': csp },
      body: `<!doctype html><title>Handlebars CSP sandbox</title><script nonce="${NONCE}">${bundle.replace(/<\/script/gi, '<\\/script')}</script><body><script nonce="${NONCE}">window.templateSession = handlebarsSandbox.createTemplateSandbox();</script></body>`,
    })
  );
  await page.goto('https://grafana.test/');
  expect(await page.evaluate(() => window.templateSession.ready)).toBe(true);
}

for (const trustedTypes of [false, true]) {
  test.describe(trustedTypes ? 'strict CSP with Trusted Types directive' : 'strict CSP', () => {
    test.beforeEach(async ({ page }) => openSandbox(page, trustedTypes));

    test('renders edited templates and fresh data, caching only the latest compilation', async ({ page }) => {
      expect(await page.evaluate(() => window.templateSession.render('Hello {{name}}', { name: '<Paul>' }))).toEqual({
        content: 'Hello &lt;Paul&gt;',
        compilations: 1,
      });
      expect(await page.evaluate(() => window.templateSession.render('Hello {{name}}', { name: 'Grafana' }))).toEqual({
        content: 'Hello Grafana',
        compilations: 1,
      });
      expect(
        await page.evaluate(() => window.templateSession.render('Changed: {{{name}}}', { name: '<b>Paul</b>' }))
      ).toEqual({ content: 'Changed: <b>Paul</b>', compilations: 2 });
      const frame = page.frames().find((frame) => frame !== page.mainFrame())!;
      expect(await frame.locator('script').count()).toBe(0);
      expect(await frame.locator('body').textContent()).toBe('');
    });

    test('preserves scopes, conditions, subexpressions, and fixture variable helpers', async ({ page }) => {
      const result = await page.evaluate(() =>
        window.templateSession.render(
          '{{#each rows}}{{#if (gt value 1)}}{{@index}}:{{../title}}={{name}};{{else}}low;{{/if}}{{/each}}{{#each (variable "region")}}{{this}};{{/each}}{{variableValue "region"}}',
          {
            title: 'load',
            rows: [
              { name: 'a', value: 1 },
              { name: 'b', value: 2 },
            ],
          }
        )
      );
      expect(result).toEqual({ content: 'low;1:load=b;east;west;east,west', compilations: 1 });
    });

    test('resolves dynamic and nested host helpers and tracks actual row access', async ({ page }) => {
      expect(
        await page.evaluate(() =>
          window.templateSession.render('{{variableValue (variableValue "selected")}} {{date 0 "YYYY"}}', {})
        )
      ).toMatchObject({ content: 'east,west 1970-01-01T00:00:00.000Z' });
      expect(
        await page.evaluate(() => window.templateSession.renderTracked('{{title}}', { title: 'Title', data: [] }))
      ).toMatchObject({ content: 'Title', readRows: false });
      expect(
        await page.evaluate(() => window.templateSession.renderTracked('{{data.length}}', { data: [1, 2] }))
      ).toMatchObject({ content: '2', readRows: true });
      expect(
        await page.evaluate(() =>
          window.templateSession.renderTracked('{{frames.0.data.length}}', { frames: [{ data: [1] }] })
        )
      ).toMatchObject({ content: '1', readRows: true });
    });

    test('cancels work without breaking the next render', async ({ page }) => {
      expect(
        await page.evaluate(async () => {
          const abort = new AbortController();
          const pending = window.templateSession.renderAbortable(abort.signal).catch((error: Error) => error.name);
          abort.abort();
          return pending;
        })
      ).toBe('AbortError');
      expect(await page.evaluate(() => window.templateSession.render('recovered', {}))).toMatchObject({
        content: 'recovered',
      });
    });

    test('returns syntax errors and recovers on the next valid template', async ({ page }) => {
      const error = await page.evaluate(() =>
        window.templateSession.render('{{#if x}}', {}).catch((error: Error) => error.message)
      );
      expect(error).toContain('Parse error');
      expect(await page.evaluate(() => window.templateSession.render('recovered', {}))).toEqual({
        content: 'recovered',
        compilations: 1,
      });
    });

    test('treats closing script tags and code-shaped template/data as text', async ({ page }) => {
      const source = '</script><script>window.compromised=true</script> " ` ${alert(1)} {{value}}';
      const result = await page.evaluate(
        (source) => window.templateSession.render(source, { value: '</script><img src=x onerror=alert(1)>' }),
        source
      );
      expect(result.content).toBe(
        '</script><script>window.compromised=true</script> " ` ${alert(1)} &lt;/script&gt;&lt;img src&#x3D;x onerror&#x3D;alert(1)&gt;'
      );
      const frame = page.frames().find((frame) => frame !== page.mainFrame())!;
      expect(await frame.evaluate(() => Reflect.get(window, 'compromised') ?? false)).toBe(false);
      expect(await frame.locator('img').count()).toBe(0);
    });

    test('rejects forged source/channel and AST messages before executing a valid request', async ({ page }) => {
      const frame = page.frames().find((frame) => frame !== page.mainFrame())!;
      const channel = await page.evaluate(() => /data-channel="([^"]+)"/.exec(window.templateSession.frame.srcdoc)![1]);
      await frame.evaluate((channel) => {
        window.dispatchEvent(
          new MessageEvent('message', {
            source: window,
            origin: 'https://grafana.test',
            data: {
              protocol: 'grafana-text-template-v1',
              channel,
              type: 'render',
              id: 800,
              helpers: [],
              trackRows: false,
              template: 'forged',
              data: {},
            },
          })
        );
      }, channel);
      await page.evaluate((channel) => {
        const target = window.templateSession.frame.contentWindow!;
        const request = {
          protocol: 'grafana-text-template-v1',
          channel,
          type: 'render',
          id: 801,
          data: {},
          helpers: [],
          trackRows: false,
        };
        target.postMessage({ ...request, channel: 'wrong', template: 'forged' }, '*');
        target.postMessage({ ...request, template: { type: 'Program', body: [] } }, '*');
      }, channel);
      expect(await page.evaluate(() => window.templateSession.render('valid', {}))).toEqual({
        content: 'valid',
        compilations: 1,
      });
    });

    test('ignores forged responses from the wrong source or channel', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const session = window.templateSession;
        const channel = /data-channel="([^"]+)"/.exec(session.frame.srcdoc)![1];
        const pending = session.render('valid', {});
        await Promise.resolve();
        await Promise.resolve();
        const data = {
          protocol: 'grafana-text-template-v1',
          channel,
          id: 1,
          type: 'result',
          content: 'forged',
          compilations: 1,
          readRows: false,
        };
        window.dispatchEvent(new MessageEvent('message', { source: window, origin: 'null', data }));
        const wrongChannel = new MessageEvent('message', { origin: 'null', data: { ...data, channel: 'wrong' } });
        // Firefox rejects an opaque WindowProxy in the synthetic event constructor.
        Object.defineProperty(wrongChannel, 'source', { value: session.frame.contentWindow });
        window.dispatchEvent(wrongChannel);
        return pending;
      });
      expect(result).toMatchObject({ content: 'valid' });
    });

    test('retains opaque origin and blocks network requests', async ({ page }) => {
      const frame = page.frames().find((frame) => frame !== page.mainFrame())!;
      const isolation = await frame.evaluate(async () => {
        const access = (read: () => unknown) => {
          try {
            read();
            return 'allowed';
          } catch (error) {
            return (error as Error).name;
          }
        };
        return {
          parentDOM: access(() => window.parent.document.body),
          storage: access(() => localStorage.length),
          network: await fetch('https://grafana.test/private').then(
            () => 'allowed',
            () => 'blocked'
          ),
        };
      });
      expect(isolation).toEqual({ parentDOM: 'SecurityError', storage: 'SecurityError', network: 'blocked' });
      expect(await page.evaluate(() => window.templateSession.render('still alive', {}))).toEqual({
        content: 'still alive',
        compilations: 1,
      });
    });

    test('fails closed when the bootstrap nonce is not authorized', async ({ page }) => {
      const error = await page.evaluate(async () => {
        const session = window.handlebarsSandbox.createTemplateSandbox('wrong-nonce', 250);
        try {
          await session.ready;
          return 'unexpected success';
        } catch (error) {
          return (error as Error).message;
        } finally {
          session.dispose();
        }
      });
      expect(error).toBe('Template frame did not initialize');
    });

    test('fails closed when generated scripts lose their nonce', async ({ page }) => {
      const frame = page.frames().find((frame) => frame !== page.mainFrame())!;
      await frame.evaluate(() => {
        Object.defineProperty(HTMLScriptElement.prototype, 'nonce', { configurable: true, set() {} });
      });
      const error = await page.evaluate(() =>
        window.templateSession.render('must not execute', {}).catch((error: Error) => error.message)
      );
      expect(error).toContain('Nonce-authorized template script did not execute');
    });

    test('bounds template/output size and keeps valid rendering usable', async ({ page }) => {
      expect(
        await page.evaluate(() =>
          window.templateSession.render('x'.repeat(1_000_001), {}).catch((error: Error) => error.message)
        )
      ).toBe('Invalid template request');
      expect(
        await page.evaluate(() =>
          window.templateSession
            .render('{{value}}', { value: 'x'.repeat(1_000_001) })
            .catch((error: Error) => error.message)
        )
      ).toContain('Template output exceeds the message limit');
      expect(await page.evaluate(() => window.templateSession.render('{{value}}', { value: 'small' }))).toEqual({
        content: 'small',
        compilations: 1,
      });
    });

    test('rejects outstanding and future work when the frame is disposed', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const pending = window.templateSession.render('pending', {}).catch((error: Error) => error.message);
        await Promise.resolve();
        window.templateSession.dispose();
        return {
          pending: await pending,
          next: await window.templateSession.render('next', {}).catch((error: Error) => error.message),
          frames: document.querySelectorAll('iframe').length,
        };
      });
      expect(result).toEqual({ pending: 'Template frame disposed', next: 'Template frame disposed', frames: 0 });
    });

    test('enforces Trusted Types sinks when supported by the browser', async ({ page }) => {
      test.skip(!trustedTypes, 'Only applies to the Trusted Types response');
      test.skip(!(await page.evaluate(() => Boolean(window.trustedTypes))), 'Browser has no Trusted Types support');
      const frame = page.frames().find((frame) => frame !== page.mainFrame())!;
      expect(
        await frame.evaluate(() => {
          try {
            document.createElement('script').textContent = 'window.bad=true';
            return 'allowed';
          } catch (error) {
            return (error as Error).name;
          }
        })
      ).toBe('TypeError');
      expect(
        await page.evaluate(() => window.templateSession.render('trusted {{value}}', { value: 'output' }))
      ).toEqual({ content: 'trusted output', compilations: 1 });
    });
  });
}
