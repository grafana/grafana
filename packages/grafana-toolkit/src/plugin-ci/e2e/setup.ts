import { downloadBrowserIfNeeded } from '../../e2e/install';

beforeAll(async () => {
  console.log('Plugin Test Runner Checking Chromium');
  jest.setTimeout(60 * 1000);
  await downloadBrowserIfNeeded();
});
