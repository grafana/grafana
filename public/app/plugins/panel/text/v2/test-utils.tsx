import { render } from '@testing-library/react';

import { type CoreApp, type DataFrame, dateTime, EventBusSrv, LoadingState } from '@grafana/data';
import { setTemplateSrv } from '@grafana/runtime';
import { PanelContextProvider, type PanelContext } from '@grafana/ui';

import { TextMode } from '../panelcfg.gen';

import { type Props, TextNGPanel } from './TextNGPanel';

// Edit mode builds variable suggestions from the template service.
setTemplateSrv({
  getVariables: () => [],
  replace: (target = '') => target,
  containsTemplate: () => false,
  updateTimeRange: () => {},
});

/** Panel data carrying the given frames, for the render-mode cases. */
export function createData(series: DataFrame[] = [{ fields: [], length: 0 }]): Props['data'] {
  return {
    state: LoadingState.Done,
    series,
    timeRange: {
      from: dateTime('2022-01-01T15:55:00Z'),
      to: dateTime('2022-07-12T15:55:00Z'),
      raw: {
        from: 'now-15m',
        to: 'now',
      },
    },
  };
}

type PropsOverrides = Partial<Omit<Props, 'options'>> & { options?: Partial<Props['options']> };

export function createProps(replaceVariables: Props['replaceVariables'], overrides: PropsOverrides = {}): Props {
  const { options, ...rest } = overrides;
  return {
    id: 1,
    data: createData(),
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
    width: 120,
    height: 120,
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    renderCounter: 1,
    title: 'Test Text Panel',
    eventBus: new EventBusSrv(),
    options: { content: '', mode: TextMode.Markdown, frameIndex: 0, ...options },
    onOptionsChange: jest.fn(),
    onFieldConfigChange: jest.fn(),
    replaceVariables,
    onChangeTimeRange: jest.fn(),
    ...rest,
  };
}

export function renderPanel(props: Props, app?: CoreApp) {
  const ui = <TextNGPanel {...props} />;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return render(app ? <PanelContextProvider value={{ app } as PanelContext}>{ui}</PanelContextProvider> : ui);
}
