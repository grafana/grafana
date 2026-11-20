import { test, expect, DEFAULT_A11Y_TAGS } from '@grafana/plugin-e2e';

test(
  'Dashboard time picker remains accessible through range selection',
  { tag: ['@a11y', '@dashboards'] },
  async ({ page, gotoDashboardPage, dashboardPage, selectors, scanForA11yViolations }) => {
    await gotoDashboardPage({ uid: 'O6f11TZWk' });
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });

    const trigger = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.openButton);
    const picker = page.getByRole('dialog', { name: 'Time range picker', exact: true });
    const scanPicker = async () => {
      await expect(picker).toBeVisible();
      const results = await scanForA11yViolations({
        include: '[role="dialog"][aria-label="Time range picker"]',
        // The presentation-role-conflict rule is a best practice, outside the default WCAG tags.
        options: { runOnly: { type: 'tag', values: [...DEFAULT_A11Y_TAGS, 'best-practice'] } },
      });
      expect.soft(results).toHaveNoA11yViolations();
    };

    await test.step('Open the picker and scan its controls', async () => {
      await trigger.click();
      await expect(picker.getByPlaceholder('Search quick ranges')).toBeVisible();
      await scanPicker();
    });

    await test.step('Filter quick ranges and navigate with the keyboard', async () => {
      await picker.getByPlaceholder('Search quick ranges').fill('minutes');
      const option = picker.getByRole('checkbox', { name: 'Last 5 minutes', exact: true });
      await picker.getByPlaceholder('Search quick ranges').press('Tab');
      await expect(picker.getByRole('button', { name: 'Clear', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(option).toBeFocused();
      await option.press('ArrowDown');
      const nextOption = picker.getByRole('checkbox', { name: 'Last 15 minutes', exact: true });
      await expect(nextOption).toBeFocused();
      await scanPicker();
      await nextOption.press('Enter');
      await expect(trigger).toContainText('Last 15 minutes');
      await expect(picker).toBeHidden();
    });

    await test.step('Reopen with the selected relative range', async () => {
      await trigger.click();
      await expect(picker.getByRole('checkbox', { name: 'Last 15 minutes', exact: true })).toBeChecked();
      await scanPicker();
    });

    await test.step('Apply an absolute range and scan its history', async () => {
      await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.fromField).fill('2022-06-08 00:00:00');
      await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.toField).fill('2022-06-10 23:59:59');
      await scanPicker();
      await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.applyTimeRange).click();
      await expect(picker).toBeHidden();
      await trigger.click();
      await expect(picker.getByText('Recently used absolute ranges')).toBeVisible();
      await scanPicker();
      await page.keyboard.press('Escape');
      await expect(picker).toBeHidden();
      await expect(trigger).toBeFocused();
    });
  }
);
