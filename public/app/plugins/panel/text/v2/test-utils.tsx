import { OpenFeatureTestProvider } from '@openfeature/react-sdk';
import { act, render } from '@testing-library/react';

import { type CoreApp, dateTime, EventBusSrv, LoadingState } from '@grafana/data';
import { setTemplateSrv } from '@grafana/runtime';
import { PanelContextProvider, type PanelContext, type PanelInlineEditChannel } from '@grafana/ui';

import { TextMode } from '../panelcfg.gen';

import { type Props, TextNGPanel } from './TextNGPanel';

// Edit mode builds variable suggestions from the template service.
setTemplateSrv({
  getVariables: () => [],
  replace: (target = '') => target,
  containsTemplate: () => false,
  updateTimeRange: () => {},
});

export function createProps(replaceVariables: Props['replaceVariables'], overrides: Partial<Props> = {}): Props {
  return {
    id: 1,
    data: {
      state: LoadingState.Done,
      series: [
        {
          fields: [],
          length: 0,
        },
      ],
      timeRange: {
        from: dateTime('2022-01-01T15:55:00Z'),
        to: dateTime('2022-07-12T15:55:00Z'),
        raw: {
          from: 'now-15m',
          to: 'now',
        },
      },
    },
    timeRange: {
      from: dateTime('2022-07-11T15:55:00Z'),
      to: dateTime('2022-07-12T15:55:00Z'),
      raw: {
        from: 'now-15m',
        to: 'now',
      },
    },
    timeZone: 'utc',
    transparent: false,
    // Roomy enough that the editor does not collapse to its compact chrome.
    width: 800,
    height: 400,
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    renderCounter: 1,
    title: 'Test Text Panel',
    eventBus: new EventBusSrv(),
    options: { content: '', mode: TextMode.Markdown },
    onOptionsChange: jest.fn(),
    onFieldConfigChange: jest.fn(),
    replaceVariables,
    onChangeTimeRange: jest.fn(),
    ...overrides,
  };
}

/** Controllable stand-in for the channel the dashboard puts on the panel context. */
export function createInlineEditChannel(initialCanEdit = false) {
  let canEdit = initialCanEdit;
  const listeners = new Set<() => void>();

  const endSession = jest.fn();
  const beginOptionsEditSession = jest.fn(() => endSession);

  const channel: PanelInlineEditChannel = {
    getState: () => canEdit,
    subscribe: (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    beginOptionsEditSession,
  };

  return {
    channel,
    beginOptionsEditSession,
    endSession,
    set(next: boolean) {
      canEdit = next;
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

export interface RenderPanelOptions {
  /** Present only when the panel is rendered by a host that supports inline editing. */
  inlineEdit?: PanelInlineEditChannel;
  /** Defaults to off, matching production until `text.dashboardEditor` is rolled out. */
  inlineEditFlag?: boolean;
  /**
   * Stands in for the panel chrome content div, which selects (and so also deselects) the panel on
   * pointer down. Lets a test assert whether the panel lets that event through.
   */
  onHostPointerDown?: (event: React.PointerEvent) => void;
}

export function renderPanel(props: Props, app?: CoreApp, options: RenderPanelOptions = {}) {
  const { inlineEdit, inlineEditFlag = false, onHostPointerDown } = options;

  const tree = (panelProps: Props) => {
    const panel = <TextNGPanel {...panelProps} />;

    return (
      // The panel reads `text.dashboardEditor` through the OpenFeature react hook, which throws
      // without a provider.
      <OpenFeatureTestProvider flagValueMap={{ 'text.dashboardEditor': inlineEditFlag }}>
        {/* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */}
        <PanelContextProvider value={{ app, inlineEdit } as PanelContext}>
          {onHostPointerDown ? <div onPointerDown={onHostPointerDown}>{panel}</div> : panel}
        </PanelContextProvider>
      </OpenFeatureTestProvider>
    );
  };

  const result = render(tree(props));

  return { ...result, rerenderPanel: (next: Props) => result.rerender(tree(next)) };
}
