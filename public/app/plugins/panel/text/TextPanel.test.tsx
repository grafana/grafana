import { render, screen } from '@testing-library/react';
import React from 'react';

import { dateTime, LoadingState, EventBusSrv } from '@grafana/data';

import { Props, TextPanel } from './TextPanel';
import { TextMode } from './models.gen';

const replaceVariablesMock = jest.fn();
const defaultProps: Props = {
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
  replaceVariables: replaceVariablesMock,
  onChangeTimeRange: jest.fn(),
};

const setup = (props: Props = defaultProps) => {
  render(<TextPanel {...props} />);
};

describe('TextPanel', () => {
  it('should render panel without content', () => {
    expect(() => setup()).not.toThrow();
  });

  it('sanitizes content in html mode', () => {
    const contentTest = '<form><p>Form tags are sanitized.</p></form>\n<script>Script tags are sanitized.</script>';
    replaceVariablesMock.mockReturnValueOnce(contentTest);
    const props = Object.assign({}, defaultProps, {
      options: { content: contentTest, mode: TextMode.HTML },
    });

    setup(props);

    expect(screen.getByTestId('TextPanel-converted-content').innerHTML).toEqual(
      '&lt;form&gt;<p>Form tags are sanitized.</p>&lt;/form&gt;\n&lt;script&gt;Script tags are sanitized.&lt;/script&gt;'
    );
  });

  it('sanitizes content in markdown mode', () => {
    const contentTest = '<form><p>Form tags are sanitized.</p></form>\n<script>Script tags are sanitized.</script>';
    replaceVariablesMock.mockReturnValueOnce(contentTest);

    const props = Object.assign({}, defaultProps, {
      options: { content: contentTest, mode: TextMode.Markdown },
    });

    setup(props);

    expect(screen.getByTestId('TextPanel-converted-content').innerHTML).toEqual(
      '&lt;form&gt;<p>Form tags are sanitized.</p>&lt;/form&gt;\n&lt;script&gt;Script tags are sanitized.&lt;/script&gt;'
    );
  });

  it('converts content to markdown when in markdown mode', async () => {
    const contentTest = 'We begin by a simple sentence.\n```code block```';
    replaceVariablesMock.mockReturnValueOnce(contentTest);

    const props = Object.assign({}, defaultProps, {
      options: { content: contentTest, mode: TextMode.Markdown },
    });

    setup(props);

    const waited = await screen.getByTestId('TextPanel-converted-content');
    expect(waited.innerHTML).toEqual('<p>We begin by a simple sentence.\n<code>code block</code></p>\n');
  });

  it('converts content to html when in html mode', () => {
    const contentTest = 'We begin by a simple sentence.\n```This is a code block\n```';
    replaceVariablesMock.mockReturnValueOnce(contentTest);
    const props = Object.assign({}, defaultProps, {
      options: { content: contentTest, mode: TextMode.HTML },
    });

    setup(props);

    expect(screen.getByTestId('TextPanel-converted-content').innerHTML).toEqual(
      'We begin by a simple sentence.\n```This is a code block\n```'
    );
  });
});
