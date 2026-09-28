import { sharedDependenciesMap } from './sharedDependencies';

const FLOT_DEPS = [
  'jquery.flot',
  'jquery.flot.crosshair',
  'jquery.flot.events',
  'jquery.flot.fillbelow',
  'jquery.flot.gauge',
  'jquery.flot.pie',
  'jquery.flot.selection',
  'jquery.flot.stack',
  'jquery.flot.stackpercent',
  'jquery.flot.time',
];

function getThunk(key: string): () => Promise<Record<string, unknown>> {
  const value: unknown = (sharedDependenciesMap as Record<string, unknown>)[key];
  if (typeof value !== 'function') {
    throw new Error(`Shared dependency "${key}" is not a lazy thunk`);
  }

  return value as () => Promise<Record<string, unknown>>;
}

describe('jquery and flot shared dependencies', () => {
  // This assertion has to run before anything invokes a thunk, so keep it first in the file.
  it('keeps jqueryWithFlot out of the module registry until a thunk runs', async () => {
    expect(require.cache[require.resolve('./jqueryWithFlot')]).toBeUndefined();

    await getThunk('jquery.flot')();

    expect(require.cache[require.resolve('./jqueryWithFlot')]).toBeDefined();
  });

  it('registers jquery and every flot dependency as a lazy thunk', () => {
    for (const key of ['jquery', ...FLOT_DEPS]) {
      expect(typeof (sharedDependenciesMap as Record<string, unknown>)[key]).toBe('function');
    }
  });

  it('resolves jquery to the jquery instance', async () => {
    const resolved = await getThunk('jquery')();

    expect(resolved.__useDefault).toBe(true);
    expect(typeof resolved.default).toBe('function');
  });

  it('resolves every flot dependency to the placeholder', async () => {
    for (const dep of FLOT_DEPS) {
      expect(await getThunk(dep)()).toEqual({ fakeDep: 1 });
    }
  });
});
