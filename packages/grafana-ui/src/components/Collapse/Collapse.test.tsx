import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Collapse } from './Collapse';

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
      <Collapse label={TEST_LABEL} onToggle={onToggle} collapsible>
        <div>{contentText}</div>
      </Collapse>
    );

    const header = screen.getByRole('button');
    await user.click(header);

    expect(onToggle).toHaveBeenCalledWith(true);
  });
});
