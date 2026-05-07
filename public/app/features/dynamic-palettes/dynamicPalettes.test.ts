import { fieldColorModeRegistry } from '@grafana/data';

import {
  DYNAMIC_PALETTES_INDEX_KEY,
  DYNAMIC_PALETTE_KEY_PREFIX,
  fetchDynamicFieldColorModes,
  isDynamicPalettesLoaded,
  loadDynamicFieldColorModes,
  registerDynamicFieldColorModes,
  resetDynamicFieldColorModesForTests,
} from './dynamicPalettes';

const wait = 2000;
let testIdCounter = 0;

function getTestPaletteId(prefix: string): string {
  testIdCounter += 1;
  return `${prefix}-${testIdCounter}`;
}

describe('dynamicPalettes', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDynamicFieldColorModesForTests();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns no modes when index key is missing', async () => {
    const modesPromise = fetchDynamicFieldColorModes();

    jest.advanceTimersByTime(wait);

    await expect(modesPromise).resolves.toEqual([]);
  });

  it('skips index entries that do not have a palette color key', async () => {
    localStorage.setItem(
      DYNAMIC_PALETTES_INDEX_KEY,
      JSON.stringify([{ id: getTestPaletteId('missing'), name: 'Missing' }])
    );

    const modesPromise = fetchDynamicFieldColorModes();

    jest.advanceTimersByTime(wait);
    await expect(modesPromise).resolves.toHaveLength(0);
  });

  it('loads and registers dynamic palettes only once', async () => {
    const paletteId = getTestPaletteId('sunset');

    localStorage.setItem(
      DYNAMIC_PALETTES_INDEX_KEY,
      JSON.stringify([{ id: paletteId, name: 'Sunset', group: 'Custom' }])
    );
    localStorage.setItem(`${DYNAMIC_PALETTE_KEY_PREFIX}${paletteId}`, JSON.stringify(['#FF0000', '#00FF00']));

    const firstLoad = loadDynamicFieldColorModes();
    jest.advanceTimersByTime(wait);
    const firstModes = await firstLoad;

    expect(firstModes).toHaveLength(1);
    expect(firstModes[0].id).toBe(paletteId);
    expect(fieldColorModeRegistry.getIfExists(paletteId)).toBeDefined();
    expect(isDynamicPalettesLoaded()).toBe(true);

    const secondLoad = await loadDynamicFieldColorModes();
    expect(secondLoad).toEqual(firstModes);
  });

  it('waits for the simulated async delay before resolving', async () => {
    localStorage.setItem(DYNAMIC_PALETTES_INDEX_KEY, JSON.stringify([]));

    let resolved = false;
    const modesPromise = fetchDynamicFieldColorModes().then(() => {
      resolved = true;
    });

    jest.advanceTimersByTime(wait - 1);
    await Promise.resolve();
    expect(resolved).toBe(false);

    jest.advanceTimersByTime(1);
    await modesPromise;
    expect(resolved).toBe(true);
  });

  it('registers modes idempotently', () => {
    const paletteId = getTestPaletteId('manual');
    const mode = {
      id: paletteId,
      name: 'Manual',
      isContinuous: false,
      isByValue: false,
      getColors: () => ['#123456', '#abcdef'],
      getCalculator: () => () => '#123456',
    };

    registerDynamicFieldColorModes([mode]);
    registerDynamicFieldColorModes([mode]);

    expect(fieldColorModeRegistry.getIfExists(paletteId)).toBeDefined();
  });
});
