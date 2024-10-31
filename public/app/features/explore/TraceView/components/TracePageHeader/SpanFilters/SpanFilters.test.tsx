import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

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
      kind: 'server',
      statusCode: 2,
      statusMessage: 'message',
      instrumentationLibraryName: 'name',
      instrumentationLibraryVersion: 'version',
      traceState: 'state',
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
  processes: {
    '1ed38015486087ca': {
      serviceName: 'Service0',
      tags: [],
    },
  },
} as unknown as Trace;

describe('SpanFilters', () => {
  let user: ReturnType<typeof userEvent.setup>;
  const SpanFiltersWithProps = ({ showFilters = true, matches }: { showFilters?: boolean; matches?: Set<string> }) => {
    const [search, setSearch] = useState(defaultFilters);
    const [showSpanFilterMatchesOnly, setShowSpanFilterMatchesOnly] = useState(false);
    const [showCriticalPathSpansOnly, setShowCriticalPathSpansOnly] = useState(false);
    const props = {
      trace: trace,
      showSpanFilters: showFilters,
      setShowSpanFilters: jest.fn(),
      showSpanFilterMatchesOnly,
      setShowSpanFilterMatchesOnly,
      showCriticalPathSpansOnly,
      setShowCriticalPathSpansOnly,
      search,
      setSearch,
      spanFilterMatches: matches,
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
    const fromOperator = screen.getByLabelText('Select min span operator');
    const fromValue = screen.getByLabelText('Select min span duration');
    const toOperator = screen.getByLabelText('Select max span operator');
    const toValue = screen.getByLabelText('Select max span duration');
    const tagKey = screen.getByLabelText('Select tag key');
    const tagOperator = screen.getByLabelText('Select tag operator');
    const tagSelectValue = screen.getByLabelText('Select tag value');

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
    expect(tagSelectValue).toBeInTheDocument();

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
    await user.click(tagOperator);
    jest.advanceTimersByTime(1000);
    await waitFor(() => {
      expect(screen.getByText('!~')).toBeInTheDocument();
      expect(screen.getByText('=~')).toBeInTheDocument();
      expect(screen.getByText('!~')).toBeInTheDocument();
    });
    await user.click(tagKey);
    jest.advanceTimersByTime(1000);
    await waitFor(() => {
      expect(screen.getByText('TagKey0')).toBeInTheDocument();
      expect(screen.getByText('TagKey1')).toBeInTheDocument();
      expect(screen.getByText('kind')).toBeInTheDocument();
      expect(screen.getByText('ProcessKey0')).toBeInTheDocument();
      expect(screen.getByText('ProcessKey1')).toBeInTheDocument();
      expect(screen.getByText('LogKey0')).toBeInTheDocument();
      expect(screen.getByText('LogKey1')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Find...')).toBeInTheDocument();
    });
  });

  it('should update filters', async () => {
    render(<SpanFiltersWithProps />);
    const serviceValue = screen.getByLabelText('Select service name');
    const spanValue = screen.getByLabelText('Select span name');
    const tagKey = screen.getByLabelText('Select tag key');
    const tagOperator = screen.getByLabelText('Select tag operator');
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
    expect(screen.queryByLabelText('Input tag value')).toBeNull();
    await selectAndCheckValue(user, tagOperator, '=~');
    expect(screen.getByLabelText('Input tag value')).toBeInTheDocument();
  });

  it('should order tag filters', async () => {
    render(<SpanFiltersWithProps />);
    const tagKey = screen.getByLabelText('Select tag key');

    await user.click(tagKey);
    jest.advanceTimersByTime(1000);
    await waitFor(() => {
      const container = screen.getByText('TagKey0').parentElement?.parentElement?.parentElement;
      expect(container?.childNodes[1].textContent).toBe('ProcessKey0');
      expect(container?.childNodes[2].textContent).toBe('ProcessKey1');
      expect(container?.childNodes[3].textContent).toBe('TagKey0');
      expect(container?.childNodes[4].textContent).toBe('TagKey1');
      expect(container?.childNodes[5].textContent).toBe('id');
      expect(container?.childNodes[6].textContent).toBe('kind');
      expect(container?.childNodes[7].textContent).toBe('library.name');
      expect(container?.childNodes[8].textContent).toBe('library.version');
      expect(container?.childNodes[9].textContent).toBe('status');
      expect(container?.childNodes[10].textContent).toBe('status.message');
      expect(container?.childNodes[11].textContent).toBe('trace.state');
      expect(container?.childNodes[12].textContent).toBe('LogKey0');
      expect(container?.childNodes[13].textContent).toBe('LogKey1');
    });
  });

  it('should only show add/remove tag when necessary', async () => {
    render(<SpanFiltersWithProps />);
    expect(screen.queryAllByLabelText('Add tag').length).toBe(0); // not filled in the default tag, so no need to add another one
    expect(screen.queryAllByLabelText('Remove tag').length).toBe(0); // mot filled in the default tag, so no values to remove
    expect(screen.getAllByLabelText('Select tag key').length).toBe(1);

    await selectAndCheckValue(user, screen.getByLabelText('Select tag key'), 'TagKey0');
    expect(screen.getAllByLabelText('Add tag').length).toBe(1);
    expect(screen.getAllByLabelText('Remove tag').length).toBe(1);

    await user.click(screen.getByLabelText('Add tag'));
    jest.advanceTimersByTime(1000);
    expect(screen.queryAllByLabelText('Add tag').length).toBe(0); // not filled in the new tag, so no need to add another one
    expect(screen.getAllByLabelText('Remove tag').length).toBe(2); // one for each tag
    expect(screen.getAllByLabelText('Select tag key').length).toBe(2);

    await user.click(screen.getAllByLabelText('Remove tag')[1]);
    jest.advanceTimersByTime(1000);
    expect(screen.queryAllByLabelText('Add tag').length).toBe(1); // filled in the default tag, so can add another one
    expect(screen.queryAllByLabelText('Remove tag').length).toBe(1); // filled in the default tag, so can remove values
    expect(screen.getAllByLabelText('Select tag key').length).toBe(1);

    await user.click(screen.getAllByLabelText('Remove tag')[0]);
    jest.advanceTimersByTime(1000);
    expect(screen.queryAllByLabelText('Add tag').length).toBe(0); // not filled in the default tag, so no need to add another one
    expect(screen.queryAllByLabelText('Remove tag').length).toBe(0); // mot filled in the default tag, so no values to remove
    expect(screen.getAllByLabelText('Select tag key').length).toBe(1);
  });

  it('should allow adding/removing tags', async () => {
    render(<SpanFiltersWithProps />);
    expect(screen.getAllByLabelText('Select tag key').length).toBe(1);
    const tagKey = screen.getByLabelText('Select tag key');
    await selectAndCheckValue(user, tagKey, 'TagKey0');

    await user.click(screen.getByLabelText('Add tag'));
    jest.advanceTimersByTime(1000);
    expect(screen.getAllByLabelText('Select tag key').length).toBe(2);

    await user.click(screen.getAllByLabelText('Remove tag')[0]);
    jest.advanceTimersByTime(1000);
    expect(screen.getAllByLabelText('Select tag key').length).toBe(1);
  });

  it('should allow resetting filters', async () => {
    render(<SpanFiltersWithProps matches={new Set('1ed38015486087ca')} />);
    const clearFiltersButton = screen.getByRole('button', { name: 'Clear filters button' });
    expect(clearFiltersButton).toBeInTheDocument();
    expect((clearFiltersButton as HTMLButtonElement)['disabled']).toBe(true);

    const serviceValue = screen.getByLabelText('Select service name');
    const spanValue = screen.getByLabelText('Select span name');
    const tagKey = screen.getByLabelText('Select tag key');
    const tagValue = screen.getByLabelText('Select tag value');
    await selectAndCheckValue(user, serviceValue, 'Service0');
    await selectAndCheckValue(user, spanValue, 'Span0');
    await selectAndCheckValue(user, tagKey, 'TagKey0');
    await selectAndCheckValue(user, tagValue, 'TagValue0');

    const matchesSwitch = screen.getByRole('switch', { name: 'Show matches only switch' });
    expect(matchesSwitch).not.toBeChecked();
    await user.click(matchesSwitch);
    expect(matchesSwitch).toBeChecked();

    expect((clearFiltersButton as HTMLButtonElement)['disabled']).toBe(false);
    await user.click(clearFiltersButton);
    expect(screen.queryByText('Service0')).not.toBeInTheDocument();
    expect(screen.queryByText('Span0')).not.toBeInTheDocument();
    expect(screen.queryByText('TagKey0')).not.toBeInTheDocument();
    expect(screen.queryByText('TagValue0')).not.toBeInTheDocument();
    expect(screen.queryByText('Add tag')).not.toBeInTheDocument();
    expect(screen.queryByText('Remove tag')).not.toBeInTheDocument();
    expect(matchesSwitch).not.toBeChecked();
  });

  it('renders buttons when span filters is collapsed', async () => {
    render(<SpanFiltersWithProps showFilters={false} />);
    expect(screen.queryByRole('button', { name: 'Next result button' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Prev result button' })).toBeInTheDocument();
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
