import { config } from 'e2e-test/core/config';
import { e2eScenario } from 'e2e-test/core/scenario';

e2eScenario('E2E dummy test', 'should have title Grafana', async browser => {
  const page = await browser.newPage();
  const response = await page.goto(config.baseUrl);
  const title = await page.title();
  expect(response.ok()).toBe(true);
  expect(title).toBe('Grafana');
});

e2eScenario('Failing test', 'should have title Grafanaaaaaa', async browser => {
  const page = await browser.newPage();
  const response = await page.goto(config.baseUrl);
  const title = await page.title();
  expect(response.ok()).toBe(true);
  expect(title).toBe('Grafanaaaaaa');
});
