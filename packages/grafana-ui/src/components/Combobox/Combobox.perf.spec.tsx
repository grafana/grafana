import { test, expect } from '@playwright/experimental-ct-react';

import { getPerformanceMetrics } from '../../../playwright/getPerformanceMetrics';
import { Select, VirtualizedSelect } from '../Select/Select';

import { Combobox } from './Combobox';

const TEST_VALUES_AMOUNT = 1e5;

const TEST_VALUES = [...Array(TEST_VALUES_AMOUNT).keys()].map((i) => ({
  label: `Option ${i}`,
  value: i.toString(),
}));

test('should render Combobox', async ({ mount, page }) => {
  const component = await mount(<Combobox value="" options={TEST_VALUES} onChange={() => {}} />);

  const metrics = await getPerformanceMetrics(page, async () => {
    await component.click();
    await component.press('ArrowDown');
    await component.press('Enter');
  });

  console.log(metrics);

  await expect(component.getByRole('combobox')).toHaveValue('Option 1');
});

test.skip('should render Select', async ({ mount, page }) => {
  const component = await mount(<Select value="" options={TEST_VALUES} onChange={() => {}} id="test-select" />);

  const metrics = await getPerformanceMetrics(page, async () => {
    await component.click();
    await component.press('ArrowDown');
    await component.press('Enter');
  });

  console.log(metrics);

  await expect(component).toContainText('Option 1');
});

test('should render VirtualizedSelect', async ({ mount, page }) => {
  const component = await mount(<VirtualizedSelect value="" options={TEST_VALUES} onChange={() => {}} />);

  const metrics = await getPerformanceMetrics(page, async () => {
    await component.click();
    await component.press('ArrowDown');
    await component.press('Enter');
  });
  console.log(metrics);

  await expect(component).toContainText('Option 1');
});
