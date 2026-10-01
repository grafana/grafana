import { act, waitFor } from '@testing-library/react';
import { type ComponentProps } from 'react';
import type AutoSizer from 'react-virtualized-auto-sizer';

import { createTheme, EventBusSrv } from '@grafana/data';

import { changeCorrelationEditorDetails } from '../state/main';

import { setupExplore, tearDown } from './helper/setup';

const testEventBus = new EventBusSrv();

jest.mock('app/core/services/context_srv', () => {
  return {
    contextSrv: {
      ...jest.requireActual('app/core/services/context_srv').contextSrv,
      hasPermission: () => true,
      getValidIntervals: (defaultIntervals: string[]) => defaultIntervals,
    },
  };
});

jest.mock('react-virtualized-auto-sizer', () => {
  return {
    __esModule: true,
    default(props: ComponentProps<typeof AutoSizer>) {
      return <div>{props.children({ width: 1000, scaledWidth: 1000, scaledHeight: 1000, height: 1000 })}</div>;
    },
  };
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: () => testEventBus,
}));

jest.mock('../hooks/useExplorePageTitle', () => ({
  useExplorePageTitle: jest.fn(),
}));

describe('ExplorePage split pane height in correlation editor mode', () => {
  afterEach(() => {
    tearDown();
  });

  // Pins the `calc()` height applied to the split pane while the correlation editor bar is shown.
  // A malformed value (e.g. a missing closing paren) is silently dropped by the browser, leaving the
  // pane without its reduced height, so we assert the applied value is the intended, valid calc().
  it('applies a valid calc() height that accounts for the correlation editor bar', async () => {
    const { store, container } = setupExplore();

    act(() => {
      store.dispatch(changeCorrelationEditorDetails({ editorMode: true }));
    });

    await waitFor(() => {
      const splitPane = container.querySelector<HTMLElement>('.SplitPane');
      expect(splitPane).not.toBeNull();
      expect(splitPane!.style.height).toBe(`calc(100% - ${createTheme().spacing(6)})`);
    });
  });
});
