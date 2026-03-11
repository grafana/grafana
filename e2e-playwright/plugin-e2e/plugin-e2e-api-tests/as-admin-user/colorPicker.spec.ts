import { expect, test } from '@grafana/plugin-e2e';

import { formatExpectError } from '../errors';

const TEST_PANEL_VIZ_NAME = 'Grafana E2ETest Panel';

test.describe(
  'plugin-e2e-api-tests admin',
  {
    tag: ['@plugins'],
  },
  () => {
    test.describe('ColorPicker', () => {
      test('should select a color using hex value', async ({ panelEditPage }) => {
        await panelEditPage.setVisualization(TEST_PANEL_VIZ_NAME);
        const customOptions = panelEditPage.getCustomOptions('Grafana E2ETest Panel');
        const colorPicker = customOptions.getColorPicker('Circle color');

        await colorPicker.selectOption('#FF5733');
        await expect(
          colorPicker,
          formatExpectError('Expected color picker to have the selected hex color')
        ).toHaveColor('#ff5733');
      });

      test('should select a color using rgb value', async ({ panelEditPage }) => {
        await panelEditPage.setVisualization(TEST_PANEL_VIZ_NAME);
        const customOptions = panelEditPage.getCustomOptions('Grafana E2ETest Panel');
        const colorPicker = customOptions.getColorPicker('Circle color');

        await colorPicker.selectOption('rgb(0, 128, 255)');
        await expect(
          colorPicker,
          formatExpectError('Expected color picker to have the selected rgb color')
        ).toHaveColor('#0080ff');
      });
    });
  }
);
