import { act, render, screen } from '@testing-library/react';

import {
  DYNAMIC_PALETTES_INDEX_KEY,
  DYNAMIC_PALETTE_KEY_PREFIX,
  resetDynamicFieldColorModesForTests,
} from './dynamicPalettes';
import { useDynamicPalettesReady } from './useDynamicFieldColorModes';

let testIdCounter = 0;

function getTestPaletteId(): string {
  testIdCounter += 1;
  return `ready-palette-${testIdCounter}`;
}

function GateProbe() {
  const ready = useDynamicPalettesReady();
  return <div>{ready ? 'ready' : 'waiting'}</div>;
}

describe('useDynamicPalettesReady', () => {
  beforeEach(() => {
    resetDynamicFieldColorModesForTests();
    localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('waits for async palette load and is synchronous on second mount', async () => {
    const paletteId = getTestPaletteId();

    localStorage.setItem(DYNAMIC_PALETTES_INDEX_KEY, JSON.stringify([{ id: paletteId, name: 'Ready palette' }]));
    localStorage.setItem(`${DYNAMIC_PALETTE_KEY_PREFIX}${paletteId}`, JSON.stringify(['#111111', '#222222']));

    const firstRender = render(<GateProbe />);
    expect(screen.getByText('waiting')).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(50);
      await Promise.resolve();
    });

    expect(screen.getByText('ready')).toBeInTheDocument();

    firstRender.unmount();
    render(<GateProbe />);
    expect(screen.getByText('ready')).toBeInTheDocument();
  });
});
