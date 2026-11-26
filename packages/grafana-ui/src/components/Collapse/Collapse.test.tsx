import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'react';

import { Collapse, ControlledCollapse } from './Collapse';

const TEST_LABEL = 'Test Collapse';

const setup = (jsx: JSX.Element) => {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
};

describe('Collapse', () => {
  it('should not render content when isOpen is false', () => {
    const contentText = 'Hidden content';

    render(
      <Collapse isOpen={false} label={TEST_LABEL}>
        <div>{contentText}</div>
      </Collapse>
    );

    expect(screen.queryByText(contentText)).not.toBeInTheDocument();
  });

  it('should render content when isOpen is true', () => {
    const contentText = 'Visible content';

    render(
      <Collapse isOpen={true} label={TEST_LABEL}>
        <div>{contentText}</div>
      </Collapse>
    );

    expect(screen.getByText(contentText)).toBeInTheDocument();
  });

  it('should call onToggle when clicked', async () => {
    const contentText = 'Toggleable content';
    const onToggle = jest.fn();

    const { user } = setup(
      <Collapse label={TEST_LABEL} onToggle={onToggle}>
        <div>{contentText}</div>
      </Collapse>
    );

    const header = screen.getByRole('button');
    await user.click(header);

    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('forwards data attributes to the toggle button only', () => {
    const { container } = render(
      <Collapse isOpen={true} label={TEST_LABEL} data-analytics-id="query_options_toggle">
        <div>Content</div>
      </Collapse>
    );

    const toggle = screen.getByRole('button');
    expect(toggle).toHaveAttribute('data-analytics-id', 'query_options_toggle');
    expect(container.querySelectorAll('[data-analytics-id]')).toHaveLength(1);
  });

  it('does not forward props that are not data attributes to the toggle button', () => {
    const spreadProps = { title: 'Spread title', 'data-analytics-id': 'query_options_toggle' };
    const { container } = render(<Collapse label={TEST_LABEL} {...spreadProps} />);

    expect(screen.getByRole('button')).toHaveAttribute('data-analytics-id', 'query_options_toggle');
    expect(container.querySelector('[title="Spread title"]')).not.toBeInTheDocument();
  });
});

describe('ControlledCollapse', () => {
  it('forwards data attributes to the toggle button only and keeps toggling', async () => {
    const { container, user } = setup(
      <ControlledCollapse label={TEST_LABEL} data-analytics-id="query_options_toggle">
        <div>Toggleable content</div>
      </ControlledCollapse>
    );

    const toggle = screen.getByRole('button');
    expect(toggle).toHaveAttribute('data-analytics-id', 'query_options_toggle');
    expect(container.querySelectorAll('[data-analytics-id]')).toHaveLength(1);
    expect(screen.queryByText('Toggleable content')).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByText('Toggleable content')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('data-analytics-id', 'query_options_toggle');
    expect(container.querySelectorAll('[data-analytics-id]')).toHaveLength(1);
  });
});
