import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';

import { defaultFilters } from '../../../useSearch';
import { Trace } from '../../types/trace';

import { SpanFilters } from './SpanFilters';

const trace: Trace = {
  traceID: '1ed38015486087ca',
  spans: [
    {
      traceID: '1ed38015486087ca',
      spanID: '1ed38015486087ca',
      operationName: 'Span0',
      tags: [{ key: 'TagKey0', type: 'string', value: 'TagValue0' }],
      process: {
        serviceName: 'Service0',
        tags: [{ key: 'ProcessKey0', type: 'string', value: 'ProcessValue0' }],
      },
      logs: [{ fields: [{ key: 'LogKey0', type: 'string', value: 'LogValue0' }] }],
    },
    {
      traceID: '1ed38015486087ca',
      spanID: '2ed38015486087ca',
      operationName: 'Span1',
      tags: [{ key: 'TagKey1', type: 'string', value: 'TagValue1' }],
      process: {
        serviceName: 'Service1',
        tags: [{ key: 'ProcessKey1', type: 'string', value: 'ProcessValue1' }],
      },
      logs: [{ fields: [{ key: 'LogKey1', type: 'string', value: 'LogValue1' }] }],
    },
  ],
} as unknown as Trace;

describe('SpanFilters', () => {
  let user: ReturnType<typeof userEvent.setup>;
  const SpanFiltersWithProps = () => {
    const [search, setSearch] = useState(defaultFilters);
    const props = {
      trace: trace,
      showSpanFilters: true,
      setShowSpanFilters: jest.fn(),
      showSpanFilterMatchesOnly: false,
      setShowSpanFilterMatchesOnly: jest.fn(),
      search: search,
      setSearch: setSearch,
      spanFilterMatches: undefined,
      focusedSpanIdForSearch: '',
      setFocusedSpanIdForSearch: jest.fn(),
      datasourceType: 'tempo',
    };

    return <SpanFilters {...props} />;
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

  it('should render', () => {
    expect(() => render(<SpanFiltersWithProps />)).not.toThrow();
  });

  it('should render filters', async () => {
    render(<SpanFiltersWithProps />);

    const serviceOperator = screen.getByLabelText('Select service name operator');
    const serviceValue = screen.getByLabelText('Select service name');
    const spanOperator = screen.getByLabelText('Select span name operator');
    const spanValue = screen.getByLabelText('Select span name');
    const fromOperator = screen.getByLabelText('Select from operator');
    const fromValue = screen.getByLabelText('Select from value');
    const toOperator = screen.getByLabelText('Select to operator');
    const toValue = screen.getByLabelText('Select to value');
    const tagKey = screen.getByLabelText('Select tag key');
    const tagOperator = screen.getByLabelText('Select tag operator');
    const tagValue = screen.getByLabelText('Select tag value');
    const addTag = screen.getByLabelText('Add tag');
    const removeTag = screen.getByLabelText('Remove tag');

    expect(serviceOperator).toBeInTheDocument();
    expect(getElemText(serviceOperator)).toBe('=');
    expect(serviceValue).toBeInTheDocument();
    expect(spanOperator).toBeInTheDocument();
    expect(getElemText(spanOperator)).toBe('=');
    expect(spanValue).toBeInTheDocument();
    expect(fromOperator).toBeInTheDocument();
    expect(getElemText(fromOperator)).toBe('>');
    expect(fromValue).toBeInTheDocument();
    expect(toOperator).toBeInTheDocument();
    expect(getElemText(toOperator)).toBe('<');
    expect(toValue).toBeInTheDocument();
    expect(tagKey).toBeInTheDocument();
    expect(tagOperator).toBeInTheDocument();
    expect(getElemText(tagOperator)).toBe('=');
    expect(tagValue).toBeInTheDocument();
    expect(addTag).toBeInTheDocument();
    expect(removeTag).toBeInTheDocument();

    await user.click(serviceValue);
    jest.advanceTimersByTime(1000);
    await waitFor(() => {
      expect(screen.getByText('Service0')).toBeInTheDocument();
      expect(screen.getByText('Service1')).toBeInTheDocument();
    });
    await user.click(spanValue);
    jest.advanceTimersByTime(1000);
    await waitFor(() => {
      expect(screen.getByText('Span0')).toBeInTheDocument();
      expect(screen.getByText('Span1')).toBeInTheDocument();
    });
    await user.click(tagKey);
    jest.advanceTimersByTime(1000);
    await waitFor(() => {
      expect(screen.getByText('TagKey0')).toBeInTheDocument();
      expect(screen.getByText('TagKey1')).toBeInTheDocument();
      expect(screen.getByText('ProcessKey0')).toBeInTheDocument();
      expect(screen.getByText('ProcessKey1')).toBeInTheDocument();
      expect(screen.getByText('LogKey0')).toBeInTheDocument();
      expect(screen.getByText('LogKey1')).toBeInTheDocument();
    });
  });

  it('should update filters', async () => {
    render(<SpanFiltersWithProps />);
    const serviceValue = screen.getByLabelText('Select service name');
    const spanValue = screen.getByLabelText('Select span name');
    const tagKey = screen.getByLabelText('Select tag key');
    const tagValue = screen.getByLabelText('Select tag value');

    expect(getElemText(serviceValue)).toBe('All service names');
    await selectAndCheckValue(user, serviceValue, 'Service0');
    expect(getElemText(spanValue)).toBe('All span names');
    await selectAndCheckValue(user, spanValue, 'Span0');

    await user.click(tagValue);
    jest.advanceTimersByTime(1000);
    await waitFor(() => expect(screen.getByText('No options found')).toBeInTheDocument());

    expect(getElemText(tagKey)).toBe('Select tag');
    await selectAndCheckValue(user, tagKey, 'TagKey0');
    expect(getElemText(tagValue)).toBe('Select value');
    await selectAndCheckValue(user, tagValue, 'TagValue0');
  });

  it('should allow adding/removing tags', async () => {
    render(<SpanFiltersWithProps />);
    expect(screen.getAllByLabelText('Select tag key').length).toBe(1);
    await user.click(screen.getByLabelText('Add tag'));
    jest.advanceTimersByTime(1000);
    expect(screen.getAllByLabelText('Select tag key').length).toBe(2);

    await user.click(screen.getAllByLabelText('Remove tag')[0]);
    jest.advanceTimersByTime(1000);
    expect(screen.getAllByLabelText('Select tag key').length).toBe(1);
  });

  it('should allow resetting filters', async () => {
    render(<SpanFiltersWithProps />);
    const resetFiltersButton = screen.getByRole('button', { name: 'Reset filters button' });
    expect(resetFiltersButton).toBeInTheDocument();
    expect((resetFiltersButton as HTMLButtonElement)['disabled']).toBe(true);

    const serviceValue = screen.getByLabelText('Select service name');
    const spanValue = screen.getByLabelText('Select span name');
    const tagKey = screen.getByLabelText('Select tag key');
    const tagValue = screen.getByLabelText('Select tag value');
    await selectAndCheckValue(user, serviceValue, 'Service0');
    await selectAndCheckValue(user, spanValue, 'Span0');
    await selectAndCheckValue(user, tagKey, 'TagKey0');
    await selectAndCheckValue(user, tagValue, 'TagValue0');

    expect((resetFiltersButton as HTMLButtonElement)['disabled']).toBe(false);
    await user.click(resetFiltersButton);
    expect(screen.queryByText('Service0')).not.toBeInTheDocument();
    expect(screen.queryByText('Span0')).not.toBeInTheDocument();
    expect(screen.queryByText('TagKey0')).not.toBeInTheDocument();
    expect(screen.queryByText('TagValue0')).not.toBeInTheDocument();
  });
});

const selectAndCheckValue = async (user: ReturnType<typeof userEvent.setup>, elem: HTMLElement, text: string) => {
  await user.click(elem);
  jest.advanceTimersByTime(1000);
  await waitFor(() => expect(screen.getByText(text)).toBeInTheDocument());

  await user.click(screen.getByText(text));
  jest.advanceTimersByTime(1000);
  expect(screen.getByText(text)).toBeInTheDocument();
};

const getElemText = (elem: HTMLElement) => {
  return elem.parentElement?.previousSibling?.textContent;
};
