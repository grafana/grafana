import { render, screen, waitFor } from '@testing-library/react';
import { ComponentProps } from 'react';

import { dateTime } from '@grafana/data';

import { createLokiDatasource } from '../mocks/datasource';

import { LokiQueryField } from './LokiQueryField';
import { Props as MonacoProps } from './monaco-query-field/MonacoQueryFieldProps';

jest.mock('./monaco-query-field/MonacoQueryFieldLazy', () => {
  const fakeQueryField = (props: MonacoProps) => {
    return <input onBlur={(e) => props.onBlur(e.currentTarget.value)} data-testid={'dummy-code-input'} type={'text'} />;
  };
  return {
    MonacoQueryFieldLazy: fakeQueryField,
  };
});

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
  });

  it('refreshes metrics when time range changes over 1 minute', async () => {
    const { rerender } = render(<LokiQueryField {...props} />);

    await waitFor(async () => {
      expect(await screen.findByTestId('dummy-code-input')).toBeInTheDocument();
    });

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
    expect(props.datasource.languageProvider.fetchLabels).toHaveBeenCalledWith({ timeRange: newRange });
  });

  it('does not refreshes metrics when time range change by less than 1 minute', async () => {
    const { rerender } = render(<LokiQueryField {...props} />);

    await waitFor(async () => {
      expect(await screen.findByTestId('dummy-code-input')).toBeInTheDocument();
    });

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
});
