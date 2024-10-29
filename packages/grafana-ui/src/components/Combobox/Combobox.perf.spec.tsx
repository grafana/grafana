import { test, expect } from '@playwright/experimental-ct-react';

import { getPerformanceMetrics } from '../../../playwright/getPerformanceMetrics';
import { Select, VirtualizedSelect } from '../Select/Select';

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

  const metrics = await getPerformanceMetrics(page, async () => {
    await component.click();
    await component.press('ArrowDown');
    await component.press('Enter');
  });

  console.log(metrics);

  await expect(component.getByRole('combobox')).toHaveValue('Option 2');
});

test('should render Select', async ({ mount, page }) => {
  const component = await mount(
    <Select
      value=""
      options={[
        { label: 'Option 1', value: '1' },
        { label: 'Option 2', value: '2' },
        { label: 'Option 3', value: '3' },
      ]}
      onChange={() => {}}
      id="test-select"
    />
  );

  const metrics = await getPerformanceMetrics(page, async () => {
    await component.click();
    await component.press('ArrowDown');
    await component.press('Enter');
  });

  console.log(metrics);

  await expect(component).toContainText('Option 2');
});

test('should render VirtualizedSelect', async ({ mount, page }) => {
  const component = await mount(
    <VirtualizedSelect
      value=""
      options={[
        { label: 'Option 1', value: '1' },
        { label: 'Option 2', value: '2' },
        { label: 'Option 3', value: '3' },
      ]}
      onChange={() => {}}
    />
  );

  const metrics = await getPerformanceMetrics(page, async () => {
    await component.click();
    await component.press('ArrowDown');
    await component.press('Enter');
  });
  console.log(metrics);

  await expect(component).toContainText('Option 2');
});
