import { expect, test } from '@playwright/test';

test('strict CSP permits sandbox templates but blocks XY threshold compilation', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  const response = await page.goto('/d/handlebars-csp-comparison');
  const policy = response!.headers()['content-security-policy'];
  expect(policy).toContain("'nonce-");
  expect(policy).not.toContain("'unsafe-eval'");

  const working = page.getByRole('region', { name: 'Works: nonce-compiled Handlebars sandbox', exact: true });
  const output = working.frameLocator('iframe[title="Text panel content"]');
  await expect(output.getByRole('heading', { name: 'Runtime compilation works' })).toBeVisible();
  await expect(output.getByRole('row', { name: 'payments 650 High', exact: true })).toBeVisible();
  await expect(output.getByRole('row', { name: 'checkout 120 Normal', exact: true })).toBeVisible();

  const original = page.getByRole('region', { name: 'Works: standard Text v2 Handlebars', exact: true });
  await expect(
    original
      .frameLocator('iframe[title="Text panel content"]')
      .getByRole('heading', { name: 'Runtime compilation works' })
  ).toBeVisible();
  await expect(
    original.frameLocator('iframe[title="Text panel content"]').getByText('Production', { exact: true })
  ).toBeVisible();
  await expect(original.getByRole('alert')).toHaveCount(0);
  const failingXY = page.getByRole('region', {
    name: 'Expected failure: XY threshold colors (unsafe-eval blocked)',
    exact: true,
  });
  await expect(failingXY.getByRole('alert')).toContainText('An unexpected error happened');
  await expect(failingXY).toContainText('unsafe-eval');
  await expect
    .poll(() => errors.some((error) => error.includes('fieldValueColors') && error.includes('EvalError')))
    .toBe(true);

  const continuous = page.getByRole('region', {
    name: 'Control: XY continuous gradient (no eval required)',
    exact: true,
  });
  await expect(continuous.locator('.uplot canvas').first()).toBeVisible();
  await expect(continuous.getByRole('alert')).toHaveCount(0);
  await page.screenshot({ path: 'data/handlebars-sandbox-demo/comparison.png', fullPage: true });
});

test('sandbox output follows real query refreshes and dashboard variables', async ({ page }) => {
  await page.goto('/d/handlebars-csp-live');
  const panel = page.getByRole('region', { name: 'Live query data → sandbox template', exact: true });
  const output = panel.frameLocator('iframe[title="Text panel content"]');
  await expect(output.getByRole('heading', { name: 'Live data · Production', exact: true })).toBeVisible();
  const firstRow = output.getByRole('row').nth(1);
  await expect(firstRow.getByRole('cell').first()).toContainText(/\d/);
  const value = firstRow.getByRole('cell').nth(1);
  await expect(value).toContainText(/\d/);
  const before = await value.innerText();
  await expect(value).not.toHaveText(before, { timeout: 20_000 });
  await page.getByRole('combobox', { name: 'Environment', exact: true }).click();
  await page.getByText('Staging', { exact: true }).click();
  await expect(output.getByRole('heading', { name: 'Live data · Staging', exact: true })).toBeVisible();
  await page.screenshot({ path: 'data/handlebars-sandbox-demo/live.png', fullPage: true });
});

test('per-row templates follow pagination under strict CSP', async ({ page }) => {
  await page.goto('/d/handlebars-csp-live');
  const panel = page.getByRole('region', { name: 'Per-row template with pagination', exact: true });
  const output = panel.frameLocator('iframe[title="Text panel content"]');
  await expect(output.getByRole('heading', { name: 'checkout', exact: true })).toBeVisible();
  await expect(output.getByText('Production: 120', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'next page', exact: true }).click();
  await expect(output.getByRole('heading', { name: 'payments', exact: true })).toBeVisible();
  await expect(output.getByText('Production: 650', { exact: true })).toBeVisible();
  await expect(output.getByRole('heading', { name: 'checkout', exact: true })).toHaveCount(0);
});

test('editor compiles an unsaved draft under strict CSP', async ({ page }) => {
  await page.setExtraHTTPHeaders({ Authorization: `Basic ${Buffer.from('admin:admin').toString('base64')}` });
  await page.goto('/d/handlebars-csp-comparison?editPanel=1');
  await page.getByRole('radio', { name: 'Split', exact: true }).click();
  const source = page.getByRole('textbox', { name: 'Text content', exact: true });
  await source.fill('<h2>Edited {{variableValue "demo_label"}}</h2>{{#each data}}<p>{{Service}}</p>{{/each}}');
  const preview = page.getByTestId('TextNGEditor-preview').frameLocator('iframe[title="Text panel content"]');
  await expect(preview.getByRole('heading', { name: 'Edited Production', exact: true })).toBeVisible();
  await expect(preview.getByText('payments', { exact: true })).toBeVisible();
});
