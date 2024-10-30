import { test, expect } from '@playwright/experimental-ct-react';

import { getPerformanceMetrics } from '../../../playwright/getPerformanceMetrics';
import { Select, VirtualizedSelect } from '../Select/Select';

import { Combobox } from './Combobox';

const TEST_VALUES_AMOUNT = 1e5;

const TEST_VALUES = [...Array(TEST_VALUES_AMOUNT).keys()].map((i) => ({
  label: `Option ${i}`,
  value: i.toString(),
}));

const CUSTOM_PROMETHEUS_METRICS: Record<string, string> = {
  JSHeapUsedSize: 'perf_test_js_heap_used_size_bytes',
  JSHeapTotalSize: 'perf_test_js_heap_size_total_bytes',
  Nodes: 'perf_test_nodes_count',
  JSEventListeners: 'perf_test_js_event_listeners_count',
};

test.only('Combobox 100k', async ({ mount, page }) => {
  const component = await mount(<Combobox value="" options={TEST_VALUES} onChange={() => {}} />);

  const metrics = await getPerformanceMetrics(page, async () => {
    await component.click();
    await component.press('ArrowDown');
    await component.press('Enter');
  });

  //console.log(metrics);
  test
    .info()
    .annotations.push({ type: 'perf_test_duration_seconds', description: (metrics.duration / 1000).toString() });
  metrics.metrics.forEach((item) => {
    if (!(item.name in CUSTOM_PROMETHEUS_METRICS)) {
      return;
    }

    test.info().annotations.push({ type: CUSTOM_PROMETHEUS_METRICS[item.name], description: item.value.toString() });
  });
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

test('VirtualizedSelect 100k', async ({ mount, page }) => {
  const component = await mount(<VirtualizedSelect value="" options={TEST_VALUES} onChange={() => {}} />);

  const metrics = await getPerformanceMetrics(page, async () => {
    await component.click();
    await component.press('ArrowDown');
    await component.press('Enter');
  });
  console.log(metrics);

  await expect(component).toContainText('Option 1');
});
