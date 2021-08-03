import React, { ComponentProps } from 'react';
import { render } from '@testing-library/react';
import { LokiQueryField } from './LokiQueryField';
import { dateTime } from '@grafana/data';

type Props = ComponentProps<typeof LokiQueryField>;

const defaultProps: Props = {
  datasource: {
    languageProvider: {
      start: () => Promise.resolve(['label1']),
      fetchLabels: Promise.resolve(['label1']),
      getSyntax: () => {},
      getLabelKeys: () => ['label1'],
      getLabelValues: () => ['value1'],
    } as any,
    getInitHints: () => [],
  } as any,
  range: {
    from: dateTime([2021, 1, 11, 12, 0, 0]),
    to: dateTime([2021, 1, 11, 18, 0, 0]),
    raw: {
      from: 'now-1h',
      to: 'now',
    },
  },
  query: { expr: '', refId: '' },
  onRunQuery: () => {},
  onChange: () => {},
  history: [],
};

describe('LokiQueryField', () => {
  it('refreshes metrics when time range changes over 1 minute', async () => {
    const fetchLabelsMock = jest.fn();
    const props = defaultProps;
    props.datasource.languageProvider.fetchLabels = fetchLabelsMock;

    const { rerender } = render(<LokiQueryField {...props} />);

    expect(fetchLabelsMock).not.toHaveBeenCalled();

    const newRange = {
      from: dateTime([2021, 1, 11, 12, 2, 0]),
      to: dateTime([2021, 1, 11, 18, 2, 0]),
      raw: {
        from: 'now-1h',
        to: 'now',
      },
    };

    rerender(<LokiQueryField {...props} range={newRange} />);
    expect(fetchLabelsMock).toHaveBeenCalledTimes(1);
  });

  it('does not refreshes metrics when time range deso not change', async () => {
    const fetchLabelsMock = jest.fn();
    const props = defaultProps;
    props.datasource.languageProvider.fetchLabels = fetchLabelsMock;

    const { rerender } = render(<LokiQueryField {...props} />);

    expect(fetchLabelsMock).not.toHaveBeenCalled();

    //same as def
    const newRange = {
      from: dateTime([2021, 1, 11, 12, 0, 20]),
      to: dateTime([2021, 1, 11, 18, 0, 20]),
      raw: {
        from: 'now-1h',
        to: 'now',
      },
    };

    rerender(<LokiQueryField {...props} range={newRange} />);
    expect(fetchLabelsMock).not.toHaveBeenCalled();
  });
});
