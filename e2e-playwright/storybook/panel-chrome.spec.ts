import { selectors } from '@grafana/e2e-selectors';
import { test, expect } from '@grafana/plugin-e2e';

import { version } from '../../package.json';

test.use({ grafanaVersion: version });

test('hover-only header actions use space only while hovered or keyboard focused', async ({ page }) => {
  await page.goto('/iframe.html?id=plugins-panelchrome--group-by-header&viewMode=story');
  const panels = page.getByRole('region', { name: /^Panel title \d+$/ });
  const toggle = page.getByRole('button', { name: 'Toggle grouping' });
  const titleWidths = () =>
    panels.getByRole('heading').evaluateAll((titles) => titles.map((title) => title.getBoundingClientRect().width));

  await expect(panels).toHaveCount(3);
  await expect(panels.first().getByRole('heading')).toBeVisible();
  const withGrouping = await titleWidths();
  await toggle.click();
  const withoutGrouping = await titleWidths();
  expect(withGrouping).toEqual(withoutGrouping);
  expect(withGrouping[0]).toBeGreaterThan(0);

  await toggle.click();
  const panel = panels.nth(1);
  const groupBy = panel.getByRole('button', { name: 'Group by', exact: true });
  await expect(groupBy).toBeHidden();
  await panel.hover();
  await expect(groupBy).toBeVisible();
  expect((await titleWidths())[1]).toBeLessThan(withoutGrouping[1]);
  await toggle.hover();
  await expect(groupBy).toBeHidden();
  expect(await titleWidths()).toEqual(withoutGrouping);

  await toggle.focus();
  await page.keyboard.press('Tab');
  await expect(panels.first()).toBeFocused();
  await expect(panels.first().getByRole('button', { name: 'Group by', exact: true })).toBeVisible();
  await panel.focus();
  await page.keyboard.press('Tab');
  await expect(panel.getByRole('heading')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tooltip', { name: 'Panel description', exact: true })).toHaveText('Panel description');
  await page.keyboard.press('Tab');
  await expect(panel.getByRole('button', { name: 'Group by', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  const menu = panel.getByRole('button', { name: /Menu for panel/ });
  await expect(menu).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'View', exact: true })).toBeVisible();
});

test('hover actions stay in the header and leave descriptions clickable', async ({ page }) => {
  await page.goto('/iframe.html?id=plugins-panelchrome--group-by-header&viewMode=story');
  const panels = page.getByRole('region', { name: /^Panel title \d+$/ });
  const tooltip = page.getByRole('tooltip', { name: 'Panel description', exact: true });

  await expect(panels).toHaveCount(3);
  for (const panel of await panels.all()) {
    await panel.getByTestId('title-items-container').click();
    await expect(tooltip).toBeVisible();
    const action = await panel.getByRole('button', { name: 'Group by', exact: true }).boundingBox();
    const header = await panel.getByTestId(selectors.components.Panels.Panel.headerContainer).boundingBox();
    const description = await panel.getByTestId('title-items-container').boundingBox();
    expect(action!.y).toBeGreaterThanOrEqual(header!.y);
    expect(action!.y + action!.height).toBeLessThanOrEqual(header!.y + header!.height);
    expect(description!.x + description!.width).toBeLessThanOrEqual(action!.x);
    await page.getByRole('button', { name: 'Toggle grouping' }).hover();
    await expect(tooltip).toBeHidden();
  }
});

test('normal header actions stay visible and hover headers retain their actions', async ({ page }) => {
  await page.goto('/iframe.html?id=plugins-panelchrome--examples&viewMode=story');
  const panel = page.getByTestId(selectors.components.Panels.Panel.title('Action and menu (should be rare)'));
  await expect(panel.getByRole('button', { name: 'Breakdown' })).toBeVisible();
  await panel.hover();
  const action = await panel.getByRole('button', { name: 'Breakdown' }).boundingBox();
  const menu = await panel.getByRole('button', { name: /Menu for panel/ }).boundingBox();
  expect(action!.x + action!.width).toBeLessThan(menu!.x);

  await page.goto('/iframe.html?id=plugins-panelchrome--examples-hover-header&viewMode=story');
  const hoverPanel = page.getByTestId(selectors.components.Panels.Panel.title('With link in hover header'));
  await hoverPanel.focus();
  await expect(hoverPanel.getByRole('link', { name: 'Error details' })).toBeVisible();
});

test('an open header popover keeps its anchor while its search input is used', async ({ page }) => {
  await page.goto('/iframe.html?id=plugins-panelchrome--group-by-header&viewMode=story');
  const panel = page.getByTestId(selectors.components.Panels.Panel.title('Panel title 210'));
  const groupBy = panel.getByRole('button', { name: 'Group by', exact: true });
  await panel.hover();
  await groupBy.click();
  const anchor = await groupBy.boundingBox();
  const search = page.getByRole('textbox', { name: 'Search group keys' });
  await search.click();
  await search.fill('cluster');
  await expect(search).toHaveValue('cluster');
  await expect(groupBy).toBeVisible();
  expect(await groupBy.boundingBox()).toEqual(anchor);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(search).toBeHidden();
  await expect(groupBy).toBeHidden();
});
