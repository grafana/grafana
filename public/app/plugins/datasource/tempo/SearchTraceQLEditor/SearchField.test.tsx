import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { FetchError } from '@grafana/runtime';

import { TraceqlFilter, TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';

import SearchField from './SearchField';

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

jest.mock('../language_provider', () => {
  return jest.fn().mockImplementation(() => {
    return { getOptionsV2 };
  });
});

describe('SearchField', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    jest.useFakeTimers();
    // Need to use delay: null here to work with fakeTimers
    // see https://github.com/testing-library/user-event/issues/833
    user = userEvent.setup({ delay: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should not render tag if hideTag is true', () => {
    const updateFilter = jest.fn((val) => {
      return val;
    });
    const filter: TraceqlFilter = { id: 'test1', valueType: 'string', tag: 'test-tag' };

    const { container } = renderSearchField(updateFilter, filter, [], true);

    expect(container.querySelector(`input[aria-label="select test1 tag"]`)).not.toBeInTheDocument();
    expect(container.querySelector(`input[aria-label="select test1 operator"]`)).toBeInTheDocument();
    expect(container.querySelector(`input[aria-label="select test1 value"]`)).toBeInTheDocument();
  });

  it('should update operator when new value is selected in operator input', async () => {
    const updateFilter = jest.fn((val) => {
      return val;
    });
    const filter: TraceqlFilter = { id: 'test1', operator: '=', valueType: 'string', tag: 'test-tag' };
    const { container } = renderSearchField(updateFilter, filter);

    const select = await container.querySelector(`input[aria-label="select test1 operator"]`);
    expect(select).not.toBeNull();
    expect(select).toBeInTheDocument();
    if (select) {
      await user.click(select);
      jest.advanceTimersByTime(1000);
      const largerThanOp = await screen.findByText('!=');
      await user.click(largerThanOp);

      expect(updateFilter).toHaveBeenCalledWith({ ...filter, operator: '!=' });
    }
  });

  it('should update value when new value is selected in value input', async () => {
    const updateFilter = jest.fn((val) => {
      return val;
    });
    const filter: TraceqlFilter = {
      id: 'test1',
      value: 'old',
      valueType: 'string',
      tag: 'test-tag',
    };
    const { container } = renderSearchField(updateFilter, filter);

    const select = await container.querySelector(`input[aria-label="select test1 value"]`);
    expect(select).not.toBeNull();
    expect(select).toBeInTheDocument();
    if (select) {
      // Add first value
      await user.click(select);
      jest.advanceTimersByTime(1000);
      const driverVal = await screen.findByText('driver');
      await user.click(driverVal);
      expect(updateFilter).toHaveBeenCalledWith({ ...filter, value: ['driver'] });

      // Add a second value
      await user.click(select);
      jest.advanceTimersByTime(1000);
      const customerVal = await screen.findByText('customer');
      await user.click(customerVal);
      expect(updateFilter).toHaveBeenCalledWith({ ...filter, value: ['driver', 'customer'] });

      // Remove the first value
      const firstValRemove = await screen.findByLabelText('Remove driver');
      await user.click(firstValRemove);
      expect(updateFilter).toHaveBeenCalledWith({ ...filter, value: ['customer'] });
    }
  });

  it('should update tag when new value is selected in tag input', async () => {
    const updateFilter = jest.fn((val) => {
      return val;
    });
    const filter: TraceqlFilter = {
      id: 'test1',
      valueType: 'string',
    };
    const { container } = renderSearchField(updateFilter, filter, ['tag1', 'tag22', 'tag33']);

    const select = await container.querySelector(`input[aria-label="select test1 tag"]`);
    expect(select).not.toBeNull();
    expect(select).toBeInTheDocument();
    if (select) {
      // Select tag22 as the tag
      await user.click(select);
      jest.advanceTimersByTime(1000);
      const tag22 = await screen.findByText('tag22');
      await user.click(tag22);
      expect(updateFilter).toHaveBeenCalledWith({ ...filter, tag: 'tag22' });

      // Select tag1 as the tag
      await user.click(select);
      jest.advanceTimersByTime(1000);
      const tag1 = await screen.findByText('tag1');
      await user.click(tag1);
      expect(updateFilter).toHaveBeenCalledWith({ ...filter, tag: 'tag1' });

      // Remove the tag
      const tagRemove = await screen.findByLabelText('select-clear-value');
      await user.click(tagRemove);
      expect(updateFilter).toHaveBeenCalledWith({ ...filter, value: undefined });
    }
  });
});

const renderSearchField = (
  updateFilter: (f: TraceqlFilter) => void,
  filter: TraceqlFilter,
  tags?: string[],
  hideTag?: boolean
) => {
  const datasource: TempoDatasource = {
    search: {
      filters: [
        {
          id: 'service-name',
          tag: 'service.name',
          operator: '=',
          scope: TraceqlSearchScope.Resource,
        },
        { id: 'span-name', type: 'static', tag: 'name', operator: '=', scope: TraceqlSearchScope.Span },
      ],
    },
  } as TempoDatasource;
  return render(
    <SearchField
      datasource={datasource}
      updateFilter={updateFilter}
      filter={filter}
      setError={function (error: FetchError): void {
        throw error;
      }}
      tags={tags || []}
      hideTag={hideTag}
    />
  );
};
