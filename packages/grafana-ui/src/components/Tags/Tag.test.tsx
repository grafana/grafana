import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Tag } from './Tag';

const setup = (jsx: JSX.Element) => {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
};

const mockOnClick = jest.fn();

describe('Tag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with icon when provided', () => {
    render(<Tag name="test-tag" icon="info-circle" />);

    const tag = screen.getByText('test-tag');
    expect(tag).toBeInTheDocument();
    expect(tag.parentElement?.querySelector('svg')).toBeInTheDocument();
  });

  it('should handle click events', async () => {
    const { user } = setup(<Tag name="test-tag" onClick={mockOnClick} />);

    const tag = screen.getByText('test-tag');
    await user.click(tag);

    expect(mockOnClick).toHaveBeenCalledWith('test-tag', expect.any(Object));
  });

  it('should render as button when onClick is provided', () => {
    render(<Tag name="test-tag" onClick={mockOnClick} />);

    const tag = screen.getByRole('button', { name: 'test-tag' });
    expect(tag).toBeInTheDocument();
  });

  it('should not render as button when onClick is not provided', () => {
    render(<Tag name="test-tag" />);

    const tag = screen.queryByRole('button', { name: 'test-tag' });
    expect(tag).not.toBeInTheDocument();
  });
});
