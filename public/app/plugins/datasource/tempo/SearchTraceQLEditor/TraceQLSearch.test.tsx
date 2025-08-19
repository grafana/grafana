import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import TempoLanguageProvider from '../language_provider';
import { initTemplateSrv } from '../test/test_utils';
import { TempoQuery } from '../types';

import TraceQLSearch from './TraceQLSearch';

const getOptionsV2 = jest.fn().mockImplementation(() => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          value: 'customer',
          label: 'customer',
          type: 'string',
        },
        {
          value: 'driver',
          label: 'driver',
          type: 'string',
        },
      ]);
    }, 1000);
  });
});

const getTags = jest.fn().mockImplementation(() => {
  return ['foo', 'bar'];
});

jest.mock('../language_provider', () => {
  return jest.fn().mockImplementation(() => {
    return { getOptionsV2, getTags };
  });
});

describe('TraceQLSearch', () => {
  const expectedValues = {
    interpolationVar: 'interpolationText',
    interpolationText: 'interpolationText',
    interpolationVarWithPipe: 'interpolationTextOne|interpolationTextTwo',
    scopedInterpolationText: 'scopedInterpolationText',
  };
  initTemplateSrv([{ name: 'templateVariable1' }, { name: 'templateVariable2' }], expectedValues);

  let user: ReturnType<typeof userEvent.setup>;

  const datasource: TempoDatasource = {
    search: {
      filters: [
        {
          id: 'service-name',
          tag: 'service.name',
          operator: '=',
          scope: TraceqlSearchScope.Resource,
        },
      ],
    },
  } as TempoDatasource;
  datasource.isStreamingSearchEnabled = () => false;
  datasource.isStreamingMetricsEnabled = () => false;
  const lp = new TempoLanguageProvider(datasource);
  lp.getIntrinsics = () => ['duration'];
  lp.generateQueryFromFilters = () => '{}';
  datasource.languageProvider = lp;
  let query: TempoQuery = {
    refId: 'A',
    queryType: 'traceqlSearch',
    key: 'Q-595a9bbc-2a25-49a7-9249-a52a0a475d83-0',
    query: '',
    filters: [{ id: 'min-duration', operator: '>', valueType: 'duration', tag: 'duration' }],
  };
  const onChange = (q: TempoQuery) => {
    query = q;
  };
  const onClearResults = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    // Need to use delay: null here to work with fakeTimers
    // see https://github.com/testing-library/user-event/issues/833
    user = userEvent.setup({ delay: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should only show add/remove tag when necessary', async () => {
    const TraceQLSearchWithProps = () => {
      const [query, setQuery] = useState<TempoQuery>({
        refId: 'A',
        queryType: 'traceqlSearch',
        key: 'Q-595a9bbc-2a25-49a7-9249-a52a0a475d83-0',
        filters: [],
      });
      return (
        <TraceQLSearch
          datasource={datasource}
          query={query}
          onChange={(q: TempoQuery) => setQuery(q)}
          onClearResults={onClearResults}
        />
      );
    };
    render(<TraceQLSearchWithProps />);

    await act(async () => {
      expect(screen.queryAllByLabelText('Add tag').length).toBe(0); // not filled in the default tag, so no need to add another one
      expect(screen.queryAllByLabelText('Remove tag').length).toBe(0); // mot filled in the default tag, so no values to remove
      expect(screen.getAllByText('Select tag').length).toBe(1);
    });

    await user.click(screen.getByText('Select tag'));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await user.click(screen.getByText('foo'));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await user.click(screen.getAllByText('Select value')[2]);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await user.click(screen.getByText('driver'));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await act(async () => {
      expect(screen.getAllByLabelText('Add tag').length).toBe(1);
      expect(screen.getAllByLabelText(/Remove tag/).length).toBe(1);
    });

    await user.click(screen.getByLabelText('Add tag'));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.queryAllByLabelText('Add tag').length).toBe(0); // not filled in the new tag, so no need to add another one
    expect(screen.getAllByLabelText(/Remove tag/).length).toBe(2); // one for each tag

    await user.click(screen.getAllByLabelText(/Remove tag/)[1]);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.queryAllByLabelText('Add tag').length).toBe(1); // filled in the default tag, so can add another one
    expect(screen.queryAllByLabelText(/Remove tag/).length).toBe(1); // filled in the default tag, so can remove values

    await user.click(screen.getAllByLabelText(/Remove tag/)[0]);
    await act(async () => {
      jest.advanceTimersByTime(1000);
      expect(screen.queryAllByLabelText('Add tag').length).toBe(0); // not filled in the default tag, so no need to add another one
      expect(screen.queryAllByLabelText(/Remove tag/).length).toBe(0); // mot filled in the default tag, so no values to remove
    });
  });

  it('should update operator when new value is selected in operator input', async () => {
    const { container } = render(
      <TraceQLSearch datasource={datasource} query={query} onChange={onChange} onClearResults={onClearResults} />
    );

    const minDurationOperator = container.querySelector(`input[aria-label="select min-duration operator"]`);
    expect(minDurationOperator).not.toBeNull();
    expect(minDurationOperator).toBeInTheDocument();

    if (minDurationOperator) {
      await user.click(minDurationOperator);
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      const regexOp = await screen.findByText('>=');
      await user.click(regexOp);
      const minDurationFilter = query.filters.find((f) => f.id === 'min-duration');
      expect(minDurationFilter).not.toBeNull();
      expect(minDurationFilter?.operator).toBe('>=');
    }
  });

  it('should add new filter when new value is selected in the service name section', async () => {
    const { container } = render(
      <TraceQLSearch datasource={datasource} query={query} onChange={onChange} onClearResults={onClearResults} />
    );
    const serviceNameValue = container.querySelector(`input[aria-label="select service-name value"]`);
    expect(serviceNameValue).not.toBeNull();
    expect(serviceNameValue).toBeInTheDocument();

    expect(query.filters.find((f) => f.id === 'service-name')).not.toBeDefined();

    if (serviceNameValue) {
      await user.click(serviceNameValue);
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      const customerValue = await screen.findByText('customer');
      await user.click(customerValue);
      const nameFilter = query.filters.find((f) => f.id === 'service-name');
      expect(nameFilter).not.toBeNull();
      expect(nameFilter?.operator).toBe('=');
      expect(nameFilter?.value).toStrictEqual(['customer']);
      expect(nameFilter?.tag).toBe('service.name');
      expect(nameFilter?.scope).toBe(TraceqlSearchScope.Resource);
    }
  });

  it('should not render static filter when no tag is configured', async () => {
    const datasource: TempoDatasource = {
      search: {
        filters: [
          {
            id: 'service-name',
            operator: '=',
            scope: TraceqlSearchScope.Resource,
          },
        ],
      },
    } as TempoDatasource;
    datasource.isStreamingSearchEnabled = () => false;
    datasource.isStreamingMetricsEnabled = () => false;

    const lp = new TempoLanguageProvider(datasource);
    lp.getIntrinsics = () => ['duration'];
    lp.generateQueryFromFilters = () => '{}';
    datasource.languageProvider = lp;
    await act(async () => {
      const { container } = render(
        <TraceQLSearch datasource={datasource} query={query} onChange={onChange} onClearResults={onClearResults} />
      );
      const serviceNameValue = container.querySelector(`input[aria-label="select service-name value"]`);
      expect(serviceNameValue).toBeNull();
      expect(serviceNameValue).not.toBeInTheDocument();
    });
  });

  it('should not render group by alert when query does not contain group by', async () => {
    await act(async () => {
      render(
        <TraceQLSearch datasource={datasource} query={query} onChange={onChange} onClearResults={onClearResults} />
      );
      expect(screen.queryByRole('button', { name: 'Remove aggregate by from this query' })).not.toBeInTheDocument();
    });
  });

  it('should render group by alert when query contains group by', async () => {
    const onChange = jest.fn();
    await waitFor(async () => {
      render(
        <TraceQLSearch
          datasource={datasource}
          query={{ ...query, groupBy: [] }}
          onChange={onChange}
          onClearResults={onClearResults}
        />
      );
      const button = screen.queryByRole('button', { name: 'Remove aggregate by from this query' });
      expect(button).toBeInTheDocument();
    });
  });
});
