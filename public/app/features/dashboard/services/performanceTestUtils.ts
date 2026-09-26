import { performance as nodePerformance, PerformanceObserver as NodePerformanceObserver } from 'node:perf_hooks';

interface ObservedPerformanceEntry {
  name: string;
  startTime: number;
  duration: number;
}

export function observePerformanceEntries(): Promise<ObservedPerformanceEntry[]> {
  return new Promise((resolve) => {
    const observer = new NodePerformanceObserver((entries, currentObserver) => {
      currentObserver.disconnect();
      resolve(entries.getEntries().map(({ name, startTime, duration }) => ({ name, startTime, duration })));
    });
    observer.observe({ entryTypes: ['mark', 'measure'] });
  });
}

export function setupNodePerformance(): void {
  // Node implements the User Timing APIs under test but omits unrelated browser-only fields.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const browserPerformance = nodePerformance as unknown as Performance;

  beforeAll(() => {
    jest.spyOn(globalThis, 'performance', 'get').mockReturnValue(browserPerformance);
  });

  beforeEach(() => {
    performance.clearMarks();
    performance.clearMeasures();
  });

  afterEach(() => {
    performance.clearMarks();
    performance.clearMeasures();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
}
