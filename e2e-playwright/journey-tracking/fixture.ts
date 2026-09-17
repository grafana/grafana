import { test as base } from '@grafana/plugin-e2e';

import { createJourneyRecorder } from './journeyRecorder';
import type { JourneyRecorder } from './types';

export const test = base.extend<{ journeyRecorder: JourneyRecorder }>({
  journeyRecorder: async ({ page }, use) => {
    const recorder = await createJourneyRecorder(page);
    // eslint-disable-next-line react-hooks/rules-of-hooks -- `use` is the Playwright fixture API, not a React hook
    await use(recorder);
    recorder.dispose();
  },
});

export { expect } from '@grafana/plugin-e2e';
