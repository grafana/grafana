import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'react';

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

  it('should render with a colorIndex larger than the number of tag colors', () => {
    render(<Tag name="test-tag" colorIndex={999999} />);

    expect(screen.getByText('test-tag')).toBeInTheDocument();
  });

  it.each(['pointer', 'Enter', 'Space'])(
    'closes with %s without activating the tag or submitting its form',
    async (input) => {
      const onClose = jest.fn();
      const onSubmit = jest.fn();
      const { user } = setup(
        <form onSubmit={onSubmit}>
          <Tag name="Region" showCloseButton onClick={mockOnClick} onClose={onClose} />
        </form>
      );
      const tag = screen.getByRole('button', { name: 'Region' });
      const close = screen.getByRole('button', { name: 'Remove tag: Region' });
      expect(tag).not.toContainElement(close);
      await user.click(tag);
      expect(mockOnClick).toHaveBeenCalledWith('Region', expect.any(Object));
      mockOnClick.mockClear();

      if (input === 'pointer') {
        await user.click(close);
      } else {
        await user.tab();
        expect(close).toHaveFocus();
        await user.keyboard(input === 'Enter' ? '{Enter}' : ' ');
      }

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledWith('Region', expect.objectContaining({ defaultPrevented: true }));
      expect(mockOnClick).not.toHaveBeenCalled();
      expect(onSubmit).not.toHaveBeenCalled();
      expect(tag).toBeInTheDocument();
    }
  );

  it('supports a custom close label on a non-clickable tag', async () => {
    const onClose = jest.fn();
    const { user } = setup(
      <Tag name="Region" showCloseButton closeButtonLabel="Remove row dimension" onClose={onClose} />
    );
    expect(screen.getByText('Region')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove row dimension' }));
    expect(onClose).toHaveBeenCalledWith('Region', expect.any(Object));
    expect(screen.queryByRole('button', { name: 'Region' })).not.toBeInTheDocument();
  });

  it('disables the close button without a callback and keeps it opt-in', () => {
    const { rerender } = render(<Tag name="Region" showCloseButton />);
    expect(screen.getByRole('button', { name: 'Remove tag: Region' })).toBeDisabled();
    rerender(<Tag name="Region" onClose={jest.fn()} />);
    expect(screen.getByText('Region')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
