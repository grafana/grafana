import { test, expect } from '@playwright/experimental-ct-react';

import { Combobox } from './Combobox';

test('should render Combobox', async ({ mount, page }) => {
  const component = await mount(
    <Combobox
      value=""
      options={[
        { label: 'Option 1', value: '1' },
        { label: 'Option 2', value: '2' },
        { label: 'Option 3', value: '3' },
      ]}
      onChange={() => {}}
    />
  );

  const client = await page.context().newCDPSession(page);
  const start = performance.now();

  client.send('Performance.enable');

  await component.click();
  await component.press('ArrowDown');
  await component.press('Enter');
  let performanceMetrics = await client.send('Performance.getMetrics');
  const end = performance.now();

  console.log(end - start);
  console.log(performanceMetrics);

  await expect(component.getByRole('combobox')).toHaveValue('Option 2');
});
