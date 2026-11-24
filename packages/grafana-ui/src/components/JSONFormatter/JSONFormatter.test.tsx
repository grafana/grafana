import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type FormEvent } from 'react';

import { JSONFormatter } from './JSONFormatter';
import { JsonExplorer } from './json_explorer/json_explorer';

const config = { animateOpen: false, animateClose: false };

describe('JSONFormatter', () => {
  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('collapses and expands an object with %s', async (_, key) => {
    const user = userEvent.setup();
    render(<JSONFormatter json={{ name: 'grafana' }} config={config} />);

    await user.tab();
    const toggle = screen.getByRole('button', { name: 'Object' });
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard(key);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('"grafana"')).not.toBeInTheDocument();

    await user.keyboard(key);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('"grafana"')).toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it('toggles nested objects independently of their parent', async () => {
    const user = userEvent.setup();
    render(<JSONFormatter json={{ nested: { value: 'inner' } }} open={1} config={config} />);

    const parent = screen.getByRole('button', { name: 'Object' });
    const nested = screen.getByRole('button', { name: /^nested:/ });
    expect(nested).toHaveAttribute('aria-expanded', 'false');

    await user.tab();
    await user.tab();
    expect(nested).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(nested).toHaveAttribute('aria-expanded', 'true');
    expect(parent).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('"inner"')).toBeInTheDocument();
  });

  it('does not submit a surrounding form', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn((event: FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <JSONFormatter json={{ name: 'grafana' }} config={config} />
      </form>
    );

    await user.click(screen.getByRole('button', { name: 'Object' }));
    expect(screen.queryByText('"grafana"')).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('only exposes a toggle for values that can be expanded', () => {
    render(
      <JSONFormatter json={{ text: 'a', count: 1, missing: null, pair: [1, 2], list: ['a', 'b'] }} config={config} />
    );

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Object', 'list:Array[2]']);
    expect(screen.getByText('pair:')).toBeInTheDocument();
  });
});

describe('JsonExplorer', () => {
  it('keeps the expanded state in sync when opened to a depth', () => {
    const explorer = new JsonExplorer({ name: 'grafana' }, 1, config);
    const { container } = render(<div />);
    container.appendChild(explorer.render());
    const toggle = screen.getByRole('button', { name: 'Object' });

    explorer.openAtDepth(0);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    explorer.openAtDepth(1);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
