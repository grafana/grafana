import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { createLokiDatasource } from '../../mocks';
import { LokiVisualQueryBinary } from '../types';

import { NestedQuery, Props as NestedQueryProps } from './NestedQuery';

type Operator = '+' | '-' | '*' | '/' | '%' | '^' | '==' | '!=' | '>' | '<' | '>=' | '<=';
type VectorMatchType = 'on' | 'ignoring';

const createMockProps = (
  operator: Operator = '/',
  vectorMatchesType: VectorMatchType = 'on',
  showExplain = false
): NestedQueryProps => {
  const nestedQuery: LokiVisualQueryBinary = {
    operator: operator,
    vectorMatchesType: vectorMatchesType,
    query: {
      labels: [],
      operations: [],
    },
  };

  const datasource = createLokiDatasource();

  const props: NestedQueryProps = {
    nestedQuery: nestedQuery,
    index: 0,
    datasource: datasource,
    onChange: jest.fn(),
    onRemove: jest.fn(),
    onRunQuery: jest.fn(),
    showExplain: showExplain,
  };

  return props;
};

// All test assertions need to be awaited for, because the component uses `useEffect` to update the state.

describe('render all elements', () => {
  it('renders the operator label', async () => {
    const props = createMockProps();
    render(<NestedQuery {...props} />);
    expect(await screen.findByText('Operator')).toBeInTheDocument();
  });

  it('renders the expected operator value', async () => {
    const props = createMockProps('!=');
    render(<NestedQuery {...props} />);
    expect(await screen.findByText('!=')).toBeInTheDocument();
  });

  it('renders the vector matches label', async () => {
    const props = createMockProps();
    render(<NestedQuery {...props} />);
    expect(await screen.findByText('Vector matches')).toBeInTheDocument();
  });

  it('renders the expected vector matches value', async () => {
    const props = createMockProps(undefined, 'ignoring');
    render(<NestedQuery {...props} />);
    expect(await screen.findByText('ignoring')).toBeInTheDocument();
  });
});

describe('exit the nested query', () => {
  it('onRemove is called when clicking (x)', async () => {
    const props = createMockProps();
    render(<NestedQuery {...props} />);
    fireEvent.click(await screen.findByLabelText('Remove nested query'));
    await waitFor(() => expect(props.onRemove).toHaveBeenCalledTimes(1));
  });
});

describe('change operator', () => {
  it('onChange is called with the correct args', async () => {
    const props = createMockProps('/', 'on');
    render(<NestedQuery {...props} />);
    userEvent.click(await screen.findByLabelText('Select operator'));
    fireEvent.click(await screen.findByText('+'));
    await waitFor(() => expect(props.onChange).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(props.onChange).toHaveBeenCalledWith(0, {
        operator: '+',
        vectorMatchesType: 'on',
        query: { labels: [], operations: [] },
      })
    );
  });
});

describe('explain mode', () => {
  it('shows the explanation when set to true', async () => {
    const props = createMockProps(undefined, undefined, true);
    render(<NestedQuery {...props} />);
    expect(await screen.findByText('Fetch all log lines matching label filters.')).toBeInTheDocument();
  });
});
