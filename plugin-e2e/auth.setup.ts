import { test as setup } from '@grafana/plugin-e2e';

setup('authenticate', async ({ login }) => {
  await login();
});
