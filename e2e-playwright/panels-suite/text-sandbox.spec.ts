import { expect, test } from '@playwright/test';
import { build, buildSync } from 'esbuild';
import path from 'node:path';

import type * as Sandbox from './text-sandbox.fixture';

declare global {
  interface Window {
    textSandbox: typeof Sandbox;
    sandboxStates: Array<Sandbox.TextSandboxState | undefined>;
    disposeSandbox?: () => void;
    sandboxSession: ReturnType<typeof Sandbox.renderSandbox>;
    sandboxHeights: number[];
    mermaidRequests: number;
  }
}

const runtimeSource = buildSync({
  entryPoints: [path.resolve(__dirname, '../../public/app/plugins/panel/text/v2/sandboxRuntime.ts')],
  bundle: true,
  write: false,
  format: 'iife',
  minify: true,
}).outputFiles[0].text;

const mermaidSource = buildSync({
  entryPoints: [path.resolve(__dirname, '../../public/app/plugins/panel/text/v2/sandboxMermaid.ts')],
  bundle: true,
  write: false,
  format: 'iife',
  minify: true,
}).outputFiles[0].text;

const scriptPromise = build({
  entryPoints: [path.resolve(__dirname, 'text-sandbox.fixture.tsx')],
  bundle: true,
  jsx: 'automatic',
  conditions: ['@grafana-app/source'],
  write: false,
  format: 'iife',
  globalName: 'textSandbox',
  plugins: [
    {
      name: 'text-panel-runtime',
      setup(build) {
        build.onResolve({ filter: /\\?text-panel-runtime$/ }, (args) => ({
          path: args.path,
          namespace: 'text-panel-runtime',
        }));
        build.onLoad({ filter: /.*/, namespace: 'text-panel-runtime' }, (args) => ({
          contents: `export default ${JSON.stringify(args.path.includes('sandboxMermaid') ? mermaidSource : runtimeSource)};`,
          loader: 'js',
        }));
      },
    },
  ],
}).then((result) => result.outputFiles[0].text);

test.describe('Text sandbox network boundary', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://grafana.test/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<div id="host"></div>' })
    );
    await page.goto('https://grafana.test/');
    await page.addScriptTag({ content: await scriptPromise });
    await page.evaluate(() => {
      window.mermaidRequests = 0;
      window.addEventListener('message', (event) => {
        if (event.data?.type === 'mermaid-needed') {
          window.mermaidRequests++;
        }
      });
    });
  });

  test('loads Mermaid only for enabled diagram blocks, including after a data refresh', async ({ page }) => {
    expect(Buffer.byteLength(runtimeSource)).toBeLessThan(10000);
    await page.evaluate(() => {
      window.sandboxStates = [];
      window.sandboxSession = window.textSandbox.renderSandbox(document.getElementById('host')!, {
        html: '<p>Plain content</p>',
        globalCss: '',
        policy: window.textSandbox.textSandboxPolicy([], '/public/fonts/'),
        mermaid: window.textSandbox.mermaidConfig(),
        title: 'Text panel content',
        onState: (state) => window.sandboxStates.push(state),
        onHeight: () => {},
      });
    });
    const content = page.frameLocator('iframe');
    await expect(content.getByText('Plain content')).toBeVisible();
    expect(await page.evaluate(() => window.mermaidRequests)).toBe(0);
    await page.evaluate(() =>
      window.sandboxSession.update({
        html: '<pre class="mermaid">flowchart LR\nA[checkout] --> B[healthy]</pre>',
        mermaid: undefined,
      })
    );
    await expect(content.locator('pre.mermaid')).toBeVisible();
    expect(await page.evaluate(() => window.mermaidRequests)).toBe(0);
    await page.evaluate(() => window.sandboxSession.update({ mermaid: window.textSandbox.mermaidConfig() }));
    await expect(content.getByText('healthy', { exact: true })).toBeVisible();
    await expect(content.locator('.mermaid-diagram svg')).toHaveCount(1);
    expect(await page.evaluate(() => window.mermaidRequests)).toBe(1);
    await page.evaluate(() => window.sandboxSession.update({ html: '<p>Plain again</p>' }));
    await expect(content.getByText('Plain again')).toBeVisible();
    expect(await page.evaluate(() => window.mermaidRequests)).toBe(1);
  });

  test('finishes initialization when a panel is outside the viewport', async ({ page }) => {
    await page.evaluate(() => {
      const host = document.getElementById('host')!;
      host.style.marginTop = '20000px';
      window.sandboxStates = [];
      window.sandboxSession = window.textSandbox.renderSandbox(host, {
        html: '<p>Offscreen content</p>',
        globalCss: '',
        policy: window.textSandbox.textSandboxPolicy([], '/public/fonts/'),
        title: 'Offscreen panel',
        onState: (state) => window.sandboxStates.push(state),
        onHeight: () => {},
      });
    });
    await expect.poll(() => page.evaluate(() => window.sandboxStates.at(-1)?.status)).toBe('ready');
  });

  test('keeps permitted content, Mermaid, sizing, and reporting alive after initial and late violations', async ({
    page,
  }) => {
    const requests: string[] = [];
    await page.route('https://external.test/**', (route) => {
      requests.push(route.request().url());
      return route.abort();
    });
    await page.evaluate(() => {
      window.sandboxStates = [];
      window.sandboxSession = window.textSandbox.renderSandbox(document.getElementById('host')!, {
        html: '<p>Permitted content</p><img src="https://external.test/initial?secret=one"><pre class="mermaid">flowchart LR\nA[checkout] --> B[healthy]</pre>',
        globalCss: '',
        title: 'Text panel content',
        policy: window.textSandbox.textSandboxPolicy([], '/public/fonts/'),
        mermaid: window.textSandbox.mermaidConfig(),
        onState: (state) => window.sandboxStates.push(state),
        onHeight: () => {},
      });
    });
    const iframe = page.getByTitle('Text panel content');
    const element = await iframe.elementHandle();
    const content = page.frameLocator('iframe');
    await expect(content.getByText('Permitted content')).toBeVisible();
    await expect(content.locator('.mermaid-diagram svg')).toHaveCount(1);
    await expect
      .poll(() => page.evaluate(() => window.sandboxStates.at(-1)?.resources))
      .toEqual([{ directive: 'img-src', origin: 'https://external.test' }]);
    await content.locator('[data-text-blocks]').evaluate((container) => {
      container.style.minHeight = '900px';
      const image = document.createElement('img');
      image.src = 'https://external.test/repeated?secret=two';
      const video = document.createElement('video');
      video.preload = 'auto';
      video.src = 'https://external.test/late?secret=three';
      container.append(image, video);
    });
    await expect
      .poll(() => page.evaluate(() => window.sandboxStates.at(-1)?.resources))
      .toEqual([
        { directive: 'img-src', origin: 'https://external.test' },
        { directive: 'media-src', origin: 'https://external.test' },
      ]);
    await expect(iframe).toHaveCSS('height', '900px');
    await expect(content.getByText('Permitted content')).toBeVisible();
    expect(await element!.evaluate((frame) => frame.isConnected)).toBe(true);
    expect(requests).toEqual([]);
  });

  test('blocks image requests before consent, recreates with approved origin, and blocks a new origin', async ({
    page,
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
          window.disposeSandbox = window.textSandbox.renderSandbox(document.getElementById('host')!, {
            html,
            globalCss: '',
            title: 'Text panel content',
            policy: window.textSandbox.textSandboxPolicy(origins, '/public/fonts/'),
            onState: (state) => window.sandboxStates.push(state),
            onHeight: () => {},
          }).unmount;
        },
        { html, origins }
      );

    await mount('<img src="https://external.test/collect?secret=first">', []);
    await expect
      .poll(() => page.evaluate(() => window.sandboxStates.at(-1)))
      .toEqual({
        status: 'ready',
        resources: [{ directive: 'img-src', origin: 'https://external.test' }],
      });
    expect(requests).toEqual([]);
    await expect(page.getByTitle('Text panel content')).toBeVisible();

    await mount('<img src="https://external.test/collect?secret=first">', ['https://external.test']);
    await expect.poll(() => page.evaluate(() => window.sandboxStates.at(-1)?.status)).toBe('ready');
    await expect.poll(() => requests).toEqual(['https://external.test/collect?secret=first']);
    await expect(page.getByTitle('Text panel content')).toBeVisible();

    await page
      .frameLocator('iframe')
      .locator('body')
      .evaluate((body) => {
        const doc = body.ownerDocument;
        const image = doc.createElement('img');
        image.src = 'https://second.test/collect?secret=later';
        doc.body.append(image);
      });
    await expect.poll(() => page.evaluate(() => window.sandboxStates.at(-1)?.resources.length ?? 0)).toBeGreaterThan(0);
    expect(requests).toEqual(['https://external.test/collect?secret=first']);
    await expect(page.getByTitle('Text panel content')).toBeVisible();
  });

  for (const [directive, html] of [
    ['frame-src', '<iframe src="https://external.test/embed?secret=value"></iframe>'],
    [
      'img-src',
      '<div style="height:20px;background-image:url(https://external.test/background?secret=value)">Content</div>',
    ],
  ]) {
    test(`blocks ${directive} resources while leaving the frame visible`, async ({ page }) => {
      const requests: string[] = [];
      await page.route('https://external.test/**', (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.evaluate((html) => {
        window.sandboxStates = [];
        window.disposeSandbox = window.textSandbox.renderSandbox(document.getElementById('host')!, {
          html,
          globalCss: '',
          title: 'Text panel content',
          policy: window.textSandbox.textSandboxPolicy([], '/public/fonts/'),
          onState: (state) => window.sandboxStates.push(state),
          onHeight: () => {},
        }).unmount;
      }, html);
      await expect
        .poll(() => page.evaluate(() => window.sandboxStates.at(-1)?.resources.length ?? 0))
        .toBeGreaterThan(0);
      expect(requests).toEqual([]);
      await expect.poll(() => page.evaluate(() => window.sandboxStates.at(-1)?.status)).toBe('ready');
      await expect(page.getByTitle('Text panel content')).toBeVisible();
    });
  }

  test('reveals styled text after runtime verification', async ({ page }) => {
    await page.evaluate(() => {
      window.sandboxStates = [];
      window.disposeSandbox = window.textSandbox.renderSandbox(document.getElementById('host')!, {
        html: '<p>Safe text</p>',
        globalCss: '.markdown-html { color: rgb(1, 2, 3); }',
        title: 'Text panel content',
        policy: window.textSandbox.textSandboxPolicy([], '/public/fonts/'),
        onState: (state) => window.sandboxStates.push(state),
        onHeight: () => {},
      }).unmount;
    });
    await expect.poll(() => page.evaluate(() => window.sandboxStates.at(-1)?.status)).toBe('ready');
    {
      await expect(page.frameLocator('iframe').getByText('Safe text')).toBeVisible();
      await expect(page.frameLocator('iframe').getByText('Safe text')).toHaveCSS('color', 'rgb(1, 2, 3)');
    }
    await expect(page.locator('#host')).toHaveCount(1);
  });

  test('tracks asynchronous content size, rebuilds for theme changes, and blocks refreshed data', async ({ page }) => {
    const requests: string[] = [];
    await page.route('https://external.test/**', (route) => {
      requests.push(route.request().url());
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" />' });
    });
    await page.evaluate(() => {
      window.sandboxStates = [];
      window.sandboxHeights = [];
      window.sandboxSession = window.textSandbox.renderSandbox(document.getElementById('host')!, {
        html: '<div id="content" style="height:40px">Content</div>',
        globalCss: '.markdown-html { color: rgb(1, 2, 3); }',
        policy: window.textSandbox.textSandboxPolicy([], '/public/fonts/'),
        title: 'Text panel content',
        onState: (state) => window.sandboxStates.push(state),
        onHeight: (height) => window.sandboxHeights.push(height),
      });
    });
    await expect.poll(() => page.evaluate(() => window.sandboxStates.at(-1)?.status)).toBe('ready');
    await expect(page.locator('iframe')).toHaveCSS('height', '40px');
    await page
      .frameLocator('iframe')
      .locator('#content')
      .evaluate((content) => {
        content.style.height = '180px';
      });
    await expect(page.locator('iframe')).toHaveCSS('height', '180px');
    await expect.poll(() => page.evaluate(() => window.sandboxHeights.at(-1))).toBe(180);

    const previous = await page.locator('iframe').elementHandle();
    await page.evaluate(() => window.sandboxSession.update({ globalCss: '.markdown-html { color: rgb(4, 5, 6); }' }));
    await expect(page.frameLocator('iframe').getByText('Content')).toHaveCSS('color', 'rgb(4, 5, 6)');
    expect(await previous!.evaluate((frame) => frame.isConnected)).toBe(false);
    await expect(page.locator('iframe')).toHaveCSS('height', '40px');

    await page.evaluate(() =>
      window.sandboxSession.update({ html: '<img src="https://external.test/refresh?secret=data">' })
    );
    await expect.poll(() => page.evaluate(() => window.sandboxStates.at(-1)?.resources.length ?? 0)).toBeGreaterThan(0);
    await expect(page.locator('iframe')).toHaveCount(1);
    expect(requests).toEqual([]);
    await page.evaluate(() =>
      window.sandboxSession.update({
        policy: window.textSandbox.textSandboxPolicy(['https://external.test'], '/public/fonts/'),
      })
    );
    await expect.poll(() => page.evaluate(() => window.sandboxStates.at(-1)?.status)).toBe('ready');
    await expect.poll(() => requests).toEqual(['https://external.test/refresh?secret=data']);
    await page.evaluate(() => window.sandboxSession.unmount());
    await expect(page.locator('iframe')).toHaveCount(0);
  });

  test('renders real Mermaid diagrams in the opaque frame and redraws on theme change', async ({ page }) => {
    await page.evaluate(() => {
      window.sandboxStates = [];
      window.sandboxSession = window.textSandbox.renderSandbox(document.getElementById('host')!, {
        html: '<pre class="mermaid">flowchart LR\nA[checkout] --> B[healthy]</pre><pre class="mermaid">sequenceDiagram\nAlice->>Bob: checkout</pre><pre class="mermaid">classDiagram\nclass Checkout {\n+pay()\n}</pre>',
        globalCss: '',
        title: 'Text panel content',
        policy: window.textSandbox.textSandboxPolicy([], '/public/fonts/'),
        mermaid: window.textSandbox.mermaidConfig('dark'),
        onState: (state) => window.sandboxStates.push(state),
        onHeight: () => {},
      });
    });
    await expect.poll(() => page.evaluate(() => window.sandboxStates.at(-1)?.status), { timeout: 15000 }).toBe('ready');
    const content = page.frameLocator('iframe');
    await expect(content.locator('.mermaid-diagram svg')).toHaveCount(3);
    await expect(content.getByText('healthy', { exact: true })).toBeVisible();
    await expect(content.getByText('Checkout', { exact: true })).toBeVisible();
    expect(await page.locator('iframe').evaluate((frame: HTMLIFrameElement) => frame.contentDocument)).toBeNull();
    const darkStyle = await content.locator('.mermaid-diagram svg style').first().textContent();
    await page.evaluate(() => window.sandboxSession.update({ mermaid: window.textSandbox.mermaidConfig('light') }));
    await expect.poll(() => content.locator('.mermaid-diagram svg style').first().textContent()).not.toBe(darkStyle);
    await expect(content.getByText('healthy', { exact: true })).toBeVisible();
  });

  test('collects consent for Mermaid images before requests and renders after approval', async ({ page }) => {
    const requests: string[] = [];
    await page.route('https://external.test/**', (route) => {
      requests.push(route.request().url());
      return route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" />',
      });
    });
    await page.evaluate(() => {
      window.sandboxStates = [];
      window.sandboxSession = window.textSandbox.renderSandbox(document.getElementById('host')!, {
        html: '<pre class="mermaid">flowchart LR\nA@{ img: "https://external.test/image?secret=synthetic", label: "checkout", h: 60 }</pre>',
        globalCss: '',
        title: 'Text panel content',
        policy: window.textSandbox.textSandboxPolicy([], '/public/fonts/'),
        mermaid: window.textSandbox.mermaidConfig(),
        onState: (state) => window.sandboxStates.push(state),
        onHeight: () => {},
      });
    });
    await expect
      .poll(() => page.evaluate(() => window.sandboxStates.at(-1)), { timeout: 15000 })
      .toEqual({
        status: 'ready',
        resources: [{ directive: 'img-src', origin: 'https://external.test' }],
      });
    expect(requests).toEqual([]);
    await expect(page.locator('iframe')).toHaveCount(1);
    await page.evaluate(() =>
      window.sandboxSession.update({
        policy: window.textSandbox.textSandboxPolicy(['https://external.test'], '/public/fonts/'),
      })
    );
    await expect.poll(() => page.evaluate(() => window.sandboxStates.at(-1)?.status), { timeout: 15000 }).toBe('ready');
    await expect(page.frameLocator('iframe').locator('.mermaid-diagram svg image')).toBeVisible();
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((url) => url === 'https://external.test/image?secret=synthetic')).toBe(true);
  });

  test('runs legacy scripts, Mermaid, images, and embeds without sandbox or custom CSP', async ({ page }) => {
    const requests: string[] = [];
    await page.route('https://external.test/**', (route) => {
      requests.push(route.request().url());
      return route.fulfill({ contentType: 'text/html', body: '<p>Legacy embed</p>' });
    });
    await page.evaluate(() => {
      window.sandboxStates = [];
      window.sandboxSession = window.textSandbox.renderSandbox(document.getElementById('host')!, {
        html: '<script>document.body.dataset.legacy = "ran";</script><pre class="mermaid">flowchart LR\nA[checkout] --> B[healthy]</pre><iframe title="Legacy embed" src="https://external.test/embed"></iframe><img src="https://external.test/image">',
        globalCss: '',
        title: 'Text panel content',
        mermaid: window.textSandbox.mermaidConfig(),
        onState: (state) => window.sandboxStates.push(state),
        onHeight: () => {},
      });
    });
    await expect.poll(() => page.evaluate(() => window.sandboxStates.at(-1)?.status), { timeout: 15000 }).toBe('ready');
    const frame = page.getByTitle('Text panel content');
    await expect(frame).not.toHaveAttribute('sandbox');
    const content = page.frameLocator('iframe[title="Text panel content"]');
    await expect(content.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(0);
    await expect(content.locator('body')).toHaveAttribute('data-legacy', 'ran');
    await expect(content.getByText('healthy', { exact: true })).toBeVisible();
    await expect(content.frameLocator('iframe').getByText('Legacy embed')).toBeVisible();
    expect(requests).toEqual(expect.arrayContaining(['https://external.test/embed', 'https://external.test/image']));
    await page.evaluate(() =>
      window.sandboxSession.update({
        html: '<p>Now protected</p>',
        policy: window.textSandbox.textSandboxPolicy([], '/public/fonts/'),
      })
    );
    await expect(content.getByText('Now protected')).toBeVisible();
    await expect(frame).toHaveAttribute('sandbox', /allow-scripts/);
    expect(await frame.evaluate((frame: HTMLIFrameElement) => frame.contentDocument)).toBeNull();
  });

  test('blocks untrusted event handlers while permitting the trusted runtime', async ({ page }) => {
    await page.evaluate(() => {
      window.sandboxStates = [];
      window.textSandbox.renderSandbox(document.getElementById('host')!, {
        html: '<p>Content</p><img src="data:image/png,invalid" onerror="parent.document.body.textContent = \'escaped\'">',
        globalCss: '',
        title: 'Text panel content',
        policy: window.textSandbox.textSandboxPolicy([], '/public/fonts/'),
        onState: (state) => window.sandboxStates.push(state),
        onHeight: () => {},
      });
    });
    await expect.poll(() => page.evaluate(() => window.sandboxStates.at(-1)?.resources.length ?? 0)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.sandboxStates.at(-1))).toMatchObject({
      resources: [expect.objectContaining({ directive: 'script-src-attr' })],
    });
    await expect(page.locator('#host')).toHaveCount(1);
  });

  test('reuses the deployment nonce without weakening inherited CSP', async ({ page }) => {
    await page.route('https://grafana.test/deployment-csp', (route) =>
      route.fulfill({
        headers: {
          'Content-Security-Policy': "script-src 'nonce-deployment-test'; style-src 'unsafe-inline'; img-src data:",
        },
        contentType: 'text/html',
        body: '<script nonce="deployment-test">window.deployment = true;</script><div id="host"></div>',
      })
    );
    await page.goto('https://grafana.test/deployment-csp');
    await page.evaluate(
      (source) => {
        const script = document.createElement('script');
        script.nonce = 'deployment-test';
        script.textContent = source;
        document.head.append(script);
      },
      await scriptPromise
    );
    await page.evaluate(() => {
      window.sandboxStates = [];
      window.textSandbox.renderSandbox(document.getElementById('host')!, {
        html: '<p>Inherited CSP works</p><pre class="mermaid">flowchart LR\nA[checkout] --> B[healthy]</pre>',
        globalCss: '',
        title: 'Text panel content',
        policy: window.textSandbox.textSandboxPolicy([], '/public/fonts/'),
        mermaid: window.textSandbox.mermaidConfig(),
        onState: (state) => window.sandboxStates.push(state),
        onHeight: () => {},
      });
    });
    await expect.poll(() => page.evaluate(() => window.sandboxStates.at(-1)?.status)).toBe('ready');
    await expect(page.frameLocator('iframe').getByText('Inherited CSP works')).toBeVisible();
    await expect(page.frameLocator('iframe').getByText('healthy', { exact: true })).toBeVisible();
  });
});
