import { test as base } from '@grafana/plugin-e2e';

import { createJourneyRecorder } from './journeyRecorder';
import type { JourneyRecorder } from './types';

export const test = base.extend<{ journeyRecorder: JourneyRecorder }>({
  journeyRecorder: async ({ page }, use) => {
    const recorder = await createJourneyRecorder(page);
    await use(recorder);
    recorder.dispose();
  },
});

export { expect } from '@grafana/plugin-e2e';
