import { render, waitFor } from '@testing-library/react';
import React from 'react';

import { dateTime, EventBusSrv } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import {
  AbsoluteTimeEvent,
  CopyTimeEvent,
  PasteTimeEvent,
  ShiftTimeEvent,
  ShiftTimeEventDirection,
  ZoomOutEvent,
} from 'app/types/events';

import { TestProvider } from '../../../../test/helpers/TestProvider';
import { configureStore } from '../../../store/configureStore';
import { initialExploreState } from '../state/main';
import { makeExplorePaneState } from '../state/utils';

import { useKeyboardShortcuts } from './useKeyboardShortcuts';

const testEventBus = new EventBusSrv();

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
    getAppEvents: () => testEventBus,
  };
});

const mockClipboard = {
  writeText: jest.fn(),
  readText: jest.fn(),
};

Object.defineProperty(global.navigator, 'clipboard', {
  value: mockClipboard,
});

const NOW = new Date('2020-10-10T00:00:00.000Z');
function daysFromNow(daysDiff: number) {
  return new Date(NOW.getTime() + daysDiff * 86400000);
}

function setup() {
  const store = configureStore({
    explore: {
      ...initialExploreState,
      panes: {
        left: makeExplorePaneState({
          range: {
            from: dateTime(),
            to: dateTime(),
            raw: { from: 'now-1d', to: 'now' },
          },
        }),
        right: makeExplorePaneState({
          range: {
            from: dateTime(),
            to: dateTime(),
            raw: { from: 'now-2d', to: 'now' },
          },
        }),
      },
    },
  });

  const Wrapper = () => {
    useKeyboardShortcuts();
    return <div></div>;
  };

  render(
    <TestProvider store={store}>
      <Wrapper />
    </TestProvider>
  );

  return store;
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('changes both panes to absolute time range', () => {
    const store = setup();

    getAppEvents().publish(new AbsoluteTimeEvent({ updateUrl: false }));

    const exploreState = store.getState().explore;
    const panes = Object.values(exploreState.panes);
    expect(panes[0]!.absoluteRange.from).toBe(daysFromNow(-1).getTime());
    expect(panes[0]!.absoluteRange.to).toBe(daysFromNow(0).getTime());
    expect(panes[1]!.absoluteRange.from).toBe(daysFromNow(-2).getTime());
    expect(panes[1]!.absoluteRange.to).toBe(daysFromNow(0).getTime());
  });

  it('shifts time range in both panes', () => {
    const store = setup();

    getAppEvents().publish(new ShiftTimeEvent({ direction: ShiftTimeEventDirection.Left }));

    const exploreState = store.getState().explore;
    const panes = Object.values(exploreState.panes);
    expect(panes[0]!.absoluteRange.from).toBe(daysFromNow(-1.5).getTime());
    expect(panes[0]!.absoluteRange.to).toBe(daysFromNow(-0.5).getTime());
    expect(panes[1]!.absoluteRange.from).toBe(daysFromNow(-3).getTime());
    expect(panes[1]!.absoluteRange.to).toBe(daysFromNow(-1).getTime());
  });

  it('zooms out the time range in both panes', () => {
    const store = setup();

    getAppEvents().publish(new ZoomOutEvent({ scale: 2 }));

    const exploreState = store.getState().explore;
    const panes = Object.values(exploreState.panes);
    expect(panes[0]!.absoluteRange.from).toBe(daysFromNow(-1.5).getTime());
    expect(panes[0]!.absoluteRange.to).toBe(daysFromNow(0.5).getTime());
    expect(panes[1]!.absoluteRange.from).toBe(daysFromNow(-3).getTime());
    expect(panes[1]!.absoluteRange.to).toBe(daysFromNow(1).getTime());
  });

  it('copies the time range from the left pane', () => {
    const store = setup();

    getAppEvents().publish(new CopyTimeEvent());

    const fromValue = store.getState().explore.panes.left!.range.raw.from;
    const toValue = store.getState().explore.panes.left!.range.raw.to;

    expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith(JSON.stringify({ from: fromValue, to: toValue }));
  });

  it('pastes the time range to left pane', async () => {
    const store = setup();

    const fromValue = 'now-3d';
    const toValue = 'now';

    mockClipboard.readText.mockResolvedValue(JSON.stringify({ from: fromValue, to: toValue }));
    getAppEvents().publish(new PasteTimeEvent({ updateUrl: false }));

    await waitFor(() => {
      const raw = store.getState().explore.panes.left!.range.raw;
      expect(raw.from).toBe(fromValue);
      expect(raw.to).toBe(toValue);
    });
  });
});
