import { render, screen } from '@testing-library/react';
import React, { ComponentProps } from 'react';

import { dateTime } from '@grafana/data';
import { config } from '@grafana/runtime';

import { createLokiDatasource } from '../mocks';

import { LokiQueryField } from './LokiQueryField';

type Props = ComponentProps<typeof LokiQueryField>;
describe('LokiQueryField', () => {
  let props: Props;
  beforeEach(() => {
    props = {
      datasource: createLokiDatasource(),
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
    jest.spyOn(props.datasource.languageProvider, 'start').mockResolvedValue([]);
    jest.spyOn(props.datasource.languageProvider, 'fetchLabels').mockResolvedValue(['label1']);
    config.featureToggles.lokiMonacoEditor = true;
  });

  it('refreshes metrics when time range changes over 1 minute', async () => {
    const { rerender } = render(<LokiQueryField {...props} />);

    expect(await screen.findByText('Loading...')).toBeInTheDocument();

    expect(props.datasource.languageProvider.fetchLabels).not.toHaveBeenCalled();

    // 2 minutes difference over the initial time
    const newRange = {
      from: dateTime([2021, 1, 11, 12, 2, 0]),
      to: dateTime([2021, 1, 11, 18, 2, 0]),
      raw: {
        from: 'now-1h',
        to: 'now',
      },
    };

    rerender(<LokiQueryField {...props} range={newRange} />);
    expect(props.datasource.languageProvider.fetchLabels).toHaveBeenCalledTimes(1);
  });

  it('does not refreshes metrics when time range change by less than 1 minute', async () => {
    const { rerender } = render(<LokiQueryField {...props} />);

    expect(await screen.findByText('Loading...')).toBeInTheDocument();

    expect(props.datasource.languageProvider.fetchLabels).not.toHaveBeenCalled();

    // 20 seconds difference over the initial time
    const newRange = {
      from: dateTime([2021, 1, 11, 12, 0, 20]),
      to: dateTime([2021, 1, 11, 18, 0, 20]),
      raw: {
        from: 'now-1h',
        to: 'now',
      },
    };

    rerender(<LokiQueryField {...props} range={newRange} />);
    expect(props.datasource.languageProvider.fetchLabels).not.toHaveBeenCalled();
  });

  it('can fall back to the legacy editor', async () => {
    config.featureToggles.lokiMonacoEditor = false;
    render(<LokiQueryField {...props} />);

    expect(await screen.findByText('Enter a Loki query (run with Shift+Enter)')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });
});
