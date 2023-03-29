import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
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
  let user: ReturnType<typeof userEvent.setup>;

  const datasource: TempoDatasource = {
    search: {
      filters: [
        {
          id: 'service-name',
          type: 'static',
          tag: 'service.name',
          operator: '=',
          scope: TraceqlSearchScope.Resource,
        },
      ],
    },
  } as TempoDatasource;

  let query: TempoQuery = {
    refId: 'A',
    queryType: 'traceqlSearch',
    key: 'Q-595a9bbc-2a25-49a7-9249-a52a0a475d83-0',
    query: '',
    filters: [{ id: 'min-duration', operator: '>', type: 'static', valueType: 'duration', tag: 'duration' }],
  };
  const onChange = (q: TempoQuery) => {
    query = q;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    // Need to use delay: null here to work with fakeTimers
    // see https://github.com/testing-library/user-event/issues/833
    user = userEvent.setup({ delay: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should update operator when new value is selected in operator input', async () => {
    const { container } = render(<TraceQLSearch datasource={datasource} query={query} onChange={onChange} />);

    const minDurationOperator = container.querySelector(`input[aria-label="select min-duration operator"]`);
    expect(minDurationOperator).not.toBeNull();
    expect(minDurationOperator).toBeInTheDocument();

    if (minDurationOperator) {
      await user.click(minDurationOperator);
      jest.advanceTimersByTime(1000);
      const regexOp = await screen.findByText('>=');
      await user.click(regexOp);
      const minDurationFilter = query.filters.find((f) => f.id === 'min-duration');
      expect(minDurationFilter).not.toBeNull();
      expect(minDurationFilter?.operator).toBe('>=');
    }
  });

  it('should add new filter when new value is selected in the service name section', async () => {
    const { container } = render(<TraceQLSearch datasource={datasource} query={query} onChange={onChange} />);
    const serviceNameValue = container.querySelector(`input[aria-label="select service-name value"]`);
    expect(serviceNameValue).not.toBeNull();
    expect(serviceNameValue).toBeInTheDocument();

    expect(query.filters.find((f) => f.id === 'service-name')).not.toBeDefined();

    if (serviceNameValue) {
      await user.click(serviceNameValue);
      jest.advanceTimersByTime(1000);
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

  it('should add new filter when new filter button is clicked and remove filter when remove button is clicked', async () => {
    render(<TraceQLSearch datasource={datasource} query={query} onChange={onChange} />);

    const dynamicFilters = query.filters.filter((f) => f.type === 'dynamic');
    expect(dynamicFilters.length).toBe(0);
    const addButton = await screen.findByTitle('Add tag');
    await user.click(addButton);
    jest.advanceTimersByTime(1000);

    // We have to rerender here so it picks up the new dynamic field
    render(<TraceQLSearch datasource={{} as TempoDatasource} query={query} onChange={onChange} />);

    const newDynamicFilters = query.filters.filter((f) => f.type === 'dynamic');
    expect(newDynamicFilters.length).toBe(1);

    const dynamicRemoveButton = await screen.findByLabelText(`remove tag with ID ${newDynamicFilters[0]?.id}`);
    await waitFor(() => expect(dynamicRemoveButton).toBeInTheDocument());
    if (dynamicRemoveButton) {
      await user.click(dynamicRemoveButton);
      expect(query.filters.filter((f) => f.type === 'dynamic')).toStrictEqual(dynamicFilters);
    }
  });
});
