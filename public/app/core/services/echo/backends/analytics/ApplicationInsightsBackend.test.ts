import { ApplicationInsightsBackend } from './ApplicationInsightsBackend';

const setAuthenticatedUserContext = jest.fn();

class FakeApplicationInsights {
  loadAppInsights() {
    return {
      setAuthenticatedUserContext,
      trackPageView: jest.fn(),
      trackEvent: jest.fn(),
    };
  }
}

describe('ApplicationInsightsBackend', () => {
  beforeEach(() => {
    setAuthenticatedUserContext.mockClear();
    window.applicationInsights = undefined;
    const system = {
      import: jest.fn().mockResolvedValue({ ApplicationInsights: FakeApplicationInsights }),
    };
    (globalThis as unknown as { System: typeof system }).System = system;
  });

  it('sets authenticated user context from the Grafana user uid', async () => {
    new ApplicationInsightsBackend({
      connectionString: 'InstrumentationKey=test',
      user: { uid: 'user-uid' } as ApplicationInsightsBackendUser,
    });

    await flushMicrotasks();

    expect(setAuthenticatedUserContext).toHaveBeenCalledWith('user-uid');
  });

  it('does not set authenticated user context when the uid is empty', async () => {
    new ApplicationInsightsBackend({
      connectionString: 'InstrumentationKey=test',
      user: { uid: '' } as ApplicationInsightsBackendUser,
    });

    await flushMicrotasks();

    expect(setAuthenticatedUserContext).not.toHaveBeenCalled();
  });
});

type ApplicationInsightsBackendUser = NonNullable<ConstructorParameters<typeof ApplicationInsightsBackend>[0]['user']>;

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
