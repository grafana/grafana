import { render, screen } from 'test/test-utils';

import { dataSource } from './ExpressionDatasource';
import { type ExpressionQueryEditorProps } from './ExpressionQueryEditor';
import { ExpressionQueryType } from './types';

const QueryEditor = dataSource.components!.QueryEditor!;

function getProps(): ExpressionQueryEditorProps {
  return {
    datasource: dataSource,
    query: dataSource.newQuery({ refId: 'B', expression: '$A + 1' }),
    queries: [{ refId: 'A' }],
    onChange: jest.fn(),
    onRunQuery: jest.fn(),
  };
}

describe('registered expression query editor', () => {
  it('defers loading until render, suspends locally, and preserves math editing and query execution', async () => {
    const props = getProps();

    expect(dataSource.getCollapsedText(props.query)).toBe('Expression: math');
    expect(require.cache[require.resolve('./ExpressionQueryEditor')]).toBeUndefined();

    const { user, rerender } = render(
      <section aria-label="Expression query">
        <QueryEditor {...props} />
      </section>
    );

    expect(screen.getByRole('region', { name: 'Expression query' })).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    const input = await screen.findByRole('textbox');
    expect(input).toHaveValue('$A + 1');
    expect(screen.getByRole('button', { name: 'Math' })).toBeInTheDocument();

    await user.type(input, '0');
    expect(props.onChange).toHaveBeenLastCalledWith({
      refId: 'B',
      datasource: { uid: '__expr__', type: '__expr__', name: 'Expression' },
      type: ExpressionQueryType.math,
      expression: '$A + 10',
    });

    rerender(
      <section aria-label="Expression query">
        <QueryEditor {...props} query={{ ...props.query, expression: '$A + 10' }} />
      </section>
    );
    expect(input).toHaveValue('$A + 10');

    await user.tab();
    expect(props.onRunQuery).toHaveBeenCalledTimes(1);
  });

  it('applies reduce defaults and retains the cached math expression across prop updates', async () => {
    const props = getProps();
    const { user, rerender } = render(<QueryEditor {...props} />);

    await user.click(await screen.findByRole('button', { name: 'Math' }));
    await user.click(await screen.findByTestId('expression-type-reduce'));
    expect(props.onChange).toHaveBeenLastCalledWith({
      ...props.query,
      type: ExpressionQueryType.reduce,
      reducer: 'mean',
    });

    const reduceQuery = { ...props.query, type: ExpressionQueryType.reduce, reducer: 'mean', expression: 'A' };
    rerender(<QueryEditor {...props} query={reduceQuery} />);

    await user.click(screen.getByRole('button', { name: 'Reduce' }));
    await user.click(await screen.findByTestId('expression-type-math'));
    expect(props.onChange).toHaveBeenLastCalledWith({
      ...reduceQuery,
      type: ExpressionQueryType.math,
      expression: '$A + 1',
    });
  });
});
