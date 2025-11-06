import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'kquZN5H7k';

test.describe('Panels test: TimeSeries', { tag: ['@panels', '@timeseries'] }, () => {
  test.describe('X-axis panning with feature flag OFF', () => {
    test.use({
      featureToggles: {
        timeRangePan: false,
      },
    });

    test('cursor does not change to grab hand and drag does not change time range', async ({
      gotoDashboardPage,
      page,
      selectors,
    }) => {
      let dashboardPage;
      let xAxis;
      let initialFrom;
      let initialTo;

      await test.step('Load dashboard and verify x-axis renders', async () => {
        dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

        const timeseriesPanel = page.locator('.uplot').first();
        await expect(timeseriesPanel, 'panel rendered').toBeVisible();

        xAxis = timeseriesPanel.locator('.u-axis').first();
        await expect(xAxis, 'x-axis rendered').toBeVisible();
      });

      await test.step('Verify cursor does not change to grab on hover', async () => {
        await xAxis.hover();

        const cursorStyle = await xAxis.evaluate((el) => window.getComputedStyle(el).cursor);
        expect(cursorStyle, 'cursor not grab').not.toBe('grab');
      });

      await test.step('Capture initial time range and drag x-axis', async () => {
        const timePickerButton = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.openButton);
        await timePickerButton.click();

        const fromField = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.fromField);
        const toField = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.toField);

        initialFrom = await fromField.inputValue();
        initialTo = await toField.inputValue();

        await page.keyboard.press('Escape');

        const axisBox = await xAxis.boundingBox();
        if (!axisBox) {
          throw new Error('X-axis bounding box not found');
        }

        const startX = axisBox.x + axisBox.width / 2;
        const startY = axisBox.y + axisBox.height / 2;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + 100, startY);
        await page.mouse.up();

        await page.waitForTimeout(1000);
      });

      await test.step('Verify time range has not changed', async () => {
        const timePickerButton = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.openButton);
        await timePickerButton.click();

        const fromField = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.fromField);
        const toField = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.toField);

        const finalFrom = await fromField.inputValue();
        const finalTo = await toField.inputValue();

        expect(finalFrom, 'from unchanged').toBe(initialFrom);
        expect(finalTo, 'to unchanged').toBe(initialTo);
      });
    });
  });

  test.describe('X-axis panning with feature flag ON', () => {
    test.use({
      featureToggles: {
        timeRangePan: true,
      },
    });

    test('cursor changes to grab hand and drag left pans forward, drag right pans backward', async ({
      gotoDashboardPage,
      page,
      selectors,
    }) => {
      let dashboardPage;
      let xAxis;
      let centerX;
      let centerY;
      let initialFromTime;
      let initialToTime;

      await test.step('Load dashboard and verify cursor changes to grab', async () => {
        dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

        const timeseriesPanel = page.locator('.uplot').first();
        await expect(timeseriesPanel, 'panel rendered').toBeVisible();

        xAxis = timeseriesPanel.locator('.u-axis').first();
        await expect(xAxis, 'x-axis rendered').toBeVisible();

        await xAxis.hover();

        const cursorStyle = await xAxis.evaluate((el) => window.getComputedStyle(el).cursor);
        expect(cursorStyle, 'cursor is grab').toBe('grab');
      });

      await test.step('Capture initial time range', async () => {
        const timePickerButton = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.openButton);
        await timePickerButton.click();

        const fromField = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.fromField);
        const toField = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.toField);

        const initialFrom = await fromField.inputValue();
        const initialTo = await toField.inputValue();
        initialFromTime = new Date(initialFrom).getTime();
        initialToTime = new Date(initialTo).getTime();

        await page.keyboard.press('Escape');

        const axisBox = await xAxis.boundingBox();
        if (!axisBox) {
          throw new Error('X-axis bounding box not found');
        }

        centerX = axisBox.x + axisBox.width / 2;
        centerY = axisBox.y + axisBox.height / 2;
      });

      await test.step('Drag right pans backward in time', async () => {
        await page.mouse.move(centerX, centerY);
        await page.mouse.down();
        await page.mouse.move(centerX + 100, centerY);
        await page.mouse.up();

        await page.waitForTimeout(1000);

        const timePickerButton = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.openButton);
        await timePickerButton.click();

        const fromField = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.fromField);
        const toField = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.toField);

        const afterRightFrom = await fromField.inputValue();
        const afterRightTo = await toField.inputValue();
        const afterRightFromTime = new Date(afterRightFrom).getTime();
        const afterRightToTime = new Date(afterRightTo).getTime();

        expect(afterRightFromTime, 'panned backward').toBeLessThan(initialFromTime);
        expect(afterRightToTime, 'panned backward').toBeLessThan(initialToTime);

        await page.keyboard.press('Escape');

        initialFromTime = afterRightFromTime;
        initialToTime = afterRightToTime;
      });

      await test.step('Drag left pans forward in time', async () => {
        await page.mouse.move(centerX, centerY);
        await page.mouse.down();
        await page.mouse.move(centerX - 100, centerY);
        await page.mouse.up();

        await page.waitForTimeout(1000);

        const timePickerButton = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.openButton);
        await timePickerButton.click();

        const fromField = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.fromField);
        const toField = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.toField);

        const afterLeftFrom = await fromField.inputValue();
        const afterLeftTo = await toField.inputValue();
        const afterLeftFromTime = new Date(afterLeftFrom).getTime();
        const afterLeftToTime = new Date(afterLeftTo).getTime();

        expect(afterLeftFromTime, 'panned forward').toBeGreaterThan(initialFromTime);
        expect(afterLeftToTime, 'panned forward').toBeGreaterThan(initialToTime);
      });
    });
  });
});
