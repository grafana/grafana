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
    expect(screen.queryByRole('button', { name: 'Math' })).not.toBeInTheDocument();

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
});
