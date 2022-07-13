import { render } from '@testing-library/react';
import React from 'react';

import { dateTime, LoadingState, EventBusSrv } from '@grafana/data';

import { Props, TextPanel } from './TextPanel';
import { TextMode } from './models.gen';

const setup = (propOverrides?: Props) => {
  const props: Props = {
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
    width: 120,
    height: 120,
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
    replaceVariables: jest.fn(),
    onChangeTimeRange: jest.fn(),
  };
  Object.assign(props, propOverrides);

  render(<TextPanel {...props} />);
};

// setup props
describe('TextPanel', () => {
  it('should render panel without content', () => {
    expect(() => setup()).not.toThrow();
  });

  it('sanitizes content in html mode', () => {});

  it('sanitizes content in markdown mode', () => {});

  it('sanitizes content in any other not markdown/html mode', () => {});

  it('converts content to markdown when in markdown mode', () => {});

  it('converts content to html when in html mode', () => {});
});
