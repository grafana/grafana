import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LokiDatasource } from '../../datasource';
import { createLokiDatasource } from '../../mocks/datasource';
import { LokiVisualQuery, LokiVisualQueryBinary } from '../types';

import { EXPLAIN_LABEL_FILTER_CONTENT } from './LokiQueryBuilderExplained';
import { NestedQueryList, Props as NestedQueryListProps } from './NestedQueryList';

const X_BUTTON_LABEL = 'Remove nested query';
function createMockProps(nestedQueriesCount = 1, showExplain = false): NestedQueryListProps {
  const operators: string[] = ['+', '-', '*', '/'];
  const nestedQueries: LokiVisualQueryBinary[] = [...Array(nestedQueriesCount).keys()].map((i) => ({
    operator: operators[i % operators.length],
    query: {
      labels: [],
      operations: [],
    },
  }));

  const query: LokiVisualQuery = {
    labels: [],
    operations: [],
    binaryQueries: nestedQueries,
  };
  const datasource: LokiDatasource = createLokiDatasource();

  const props: NestedQueryListProps = {
    query: query,
    datasource: datasource,
    showExplain: showExplain,
    onChange: jest.fn(),
    onRunQuery: jest.fn(),
  };

  return props;
}

describe('render nested queries', () => {
  it.each([1, 3])('%i nested queries can be rendered', async (queriesCount) => {
    const props = createMockProps(queriesCount, false);
    render(<NestedQueryList {...props} />);

    const nestedQueryCloseButtons = await screen.findAllByLabelText(X_BUTTON_LABEL);
    expect(nestedQueryCloseButtons).toHaveLength(queriesCount);
  });

  it('shows explanations for all nested queries', async () => {
    const props = createMockProps(3, true);
    render(<NestedQueryList {...props} />);

    const nestedQueryCloseButtons = await screen.findAllByText(EXPLAIN_LABEL_FILTER_CONTENT);
    expect(nestedQueryCloseButtons).toHaveLength(3);
  });
});

describe('events from nested queries', () => {
  it('onChange is called when user removes one', async () => {
    const props: NestedQueryListProps = createMockProps(3, false);
    render(<NestedQueryList {...props} />);

    const xButton: HTMLElement[] = await screen.findAllByLabelText(X_BUTTON_LABEL);
    await userEvent.click(xButton[0]);

    const removedQuery: LokiVisualQueryBinary[] = [props.query.binaryQueries![0]];
    await waitFor(() => {
      expect(props.onChange).toHaveBeenCalledWith({
        ...props.query,
        binaryQueries: expect.not.arrayContaining(removedQuery),
      });
    });
  });

  it('onChange is called from sub-query', async () => {
    const props = createMockProps(4, false);
    const subQuery = { ...props.query.binaryQueries![3] };
    props.query.binaryQueries![0].query.binaryQueries = [subQuery];
    render(<NestedQueryList {...props} />);

    const xButton: HTMLElement[] = await screen.findAllByLabelText(X_BUTTON_LABEL);
    await userEvent.click(xButton[1]);

    await waitFor(async () => {
      expect(props.onChange).toHaveBeenCalledTimes(1);
    });
  });
});
