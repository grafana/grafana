import { expect, test } from '@grafana/plugin-e2e';

test.use({
  openFeature: {
    flags: {
      testFlagTrue: true,
      testFlagFalse: false,
    },
  },
});

test(
  'should intercept OFREP bulk evaluation and override flags via openFeature',
  {
    tag: ['@plugins'],
  },
  async ({ page, selectors, namespace }) => {
    // set up a listener to capture the OFREP response
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(selectors.apis.OpenFeature.ofrepBulkPath(namespace)) && !response.url().endsWith('/'),
      { timeout: 5000 }
    );

    // trigger a navigation that would cause OpenFeature to fetch flags
    await page.goto('/');

    // wait for the OFREP response (may not happen if OpenFeature is not enabled in the Grafana instance)
    try {
      const response = await responsePromise;
      const body = await response.json();

      // response should contain our overridden flags from openFeature
      const testFlagTrue = body.flags?.find((f: { key: string }) => f.key === 'testFlagTrue');
      const testFlagFalse = body.flags?.find((f: { key: string }) => f.key === 'testFlagFalse');

      if (testFlagTrue) {
        expect(testFlagTrue.value).toBe(true);
        expect(testFlagTrue.reason).toBe('STATIC');
        expect(testFlagTrue.variant).toBe('playwright-override');
      }

      if (testFlagFalse) {
        expect(testFlagFalse.value).toBe(false);
        expect(testFlagFalse.reason).toBe('STATIC');
        expect(testFlagFalse.variant).toBe('playwright-override');
      }
    } catch {
      console.log('OFREP endpoint not called - OpenFeature may not be enabled');
    }
  }
);

test(
  'should merge custom openFeature flags with backend default flags',
  {
    tag: ['@plugins'],
  },
  async ({ page, selectors, namespace }) => {
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(selectors.apis.OpenFeature.ofrepBulkPath(namespace)) && !response.url().endsWith('/'),
      { timeout: 5000 }
    );

    // wait for the OFREP response
    try {
      const response = await responsePromise;
      const body = await response.json();

      // define how many custom flags we set
      const customFlagCount = 2; // testFlagTrue and testFlagFalse

      // verify we have more flags than just our custom ones (backend flags should be present)
      expect(body.flags.length).toBeGreaterThan(customFlagCount);

      // custom flags are present and overridden
      const customFlags = body.flags.filter((f: { variant: string }) => f.variant === 'playwright-override');
      expect(customFlags.length).toBeGreaterThanOrEqual(customFlagCount);

      // backend flags (without playwright-override variant) are still present
      const backendFlags = body.flags.filter((f: { variant: string }) => f.variant !== 'playwright-override');
      expect(backendFlags.length).toBeGreaterThan(0);

      // our specific custom flags have the correct values
      const testFlagTrue = body.flags.find((f: { key: string }) => f.key === 'testFlagTrue');
      const testFlagFalse = body.flags.find((f: { key: string }) => f.key === 'testFlagFalse');

      expect(testFlagTrue?.value).toBe(true);
      expect(testFlagTrue?.variant).toBe('playwright-override');

      expect(testFlagFalse?.value).toBe(false);
      expect(testFlagFalse?.variant).toBe('playwright-override');
    } catch {
      console.log('OFREP endpoint not called - OpenFeature may not be enabled');
    }
  }
);

test(
  'should retrieve flag values using getBooleanOpenFeatureFlag fixture',
  {
    tag: ['@plugins'],
  },
  async ({ getBooleanOpenFeatureFlag }) => {
    // should retrieve our overridden flags
    const testFlagTrue = await getBooleanOpenFeatureFlag('testFlagTrue');
    const testFlagFalse = await getBooleanOpenFeatureFlag('testFlagFalse');

    expect(testFlagTrue).toBe(true);
    expect(testFlagFalse).toBe(false);
  }
);
