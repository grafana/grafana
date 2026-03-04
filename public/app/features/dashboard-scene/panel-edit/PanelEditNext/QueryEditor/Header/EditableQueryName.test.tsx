import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataQuery } from '@grafana/schema';

import { EditableQueryName } from './EditableQueryName';

function getQuery(refId: string): DataQuery {
  return { refId, datasource: { type: 'test', uid: 'test' } };
}

describe('EditableQueryName', () => {
  it('saves rename on blur when focus does not move to a sidebar card', async () => {
    const onQueryUpdate = jest.fn();
    const queryA = getQuery('A');
    const queryB = getQuery('B');
    const user = userEvent.setup();

    render(<EditableQueryName query={queryA} queries={[queryA, queryB]} onQueryUpdate={onQueryUpdate} />);

    await user.click(screen.getByRole('button', { name: /edit query name/i }));
    const input = screen.getByTestId('query-name-input');
    await user.clear(input);
    await user.type(input, 'C');

    fireEvent.blur(input);

    expect(onQueryUpdate).toHaveBeenCalledWith({ ...queryA, refId: 'C' }, 'A');
  });

  it('discards draft rename when blur is caused by clicking a sidebar card', async () => {
    const onQueryUpdate = jest.fn();
    const queryA = getQuery('A');
    const queryB = getQuery('B');
    const user = userEvent.setup();

    render(<EditableQueryName query={queryA} queries={[queryA, queryB]} onQueryUpdate={onQueryUpdate} />);

    await user.click(screen.getByRole('button', { name: /edit query name/i }));
    const input = screen.getByTestId('query-name-input');
    await user.clear(input);
    await user.type(input, 'C');

    const sidebarCard = document.createElement('button');
    sidebarCard.setAttribute('data-query-sidebar-card', 'B');
    document.body.appendChild(sidebarCard);

    fireEvent.mouseDown(sidebarCard);
    fireEvent.blur(input, { relatedTarget: sidebarCard });

    expect(onQueryUpdate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('query-name-input')).not.toBeInTheDocument();

    document.body.removeChild(sidebarCard);
  });

  it('exits editing mode when selected query changes via keyed remount', async () => {
    const onQueryUpdate = jest.fn();
    const queryA = getQuery('A');
    const queryB = getQuery('B');
    const user = userEvent.setup();

    const { rerender } = render(
      <EditableQueryName key={queryA.refId} query={queryA} queries={[queryA, queryB]} onQueryUpdate={onQueryUpdate} />
    );

    await user.click(screen.getByRole('button', { name: /edit query name/i }));
    expect(screen.getByTestId('query-name-input')).toBeInTheDocument();

    rerender(
      <EditableQueryName key={queryB.refId} query={queryB} queries={[queryA, queryB]} onQueryUpdate={onQueryUpdate} />
    );

    expect(screen.queryByTestId('query-name-input')).not.toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(onQueryUpdate).not.toHaveBeenCalled();
  });
});
