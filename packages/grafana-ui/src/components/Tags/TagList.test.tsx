import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TagList } from './TagList';
import { Tag } from './Tag';

const setup = (jsx: JSX.Element) => {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
};

const mockTags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'];
const mockOnClick = jest.fn();

describe('TagList and Tag Components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TagList', () => {
    it('should render all tags when displayMax is not provided', () => {
      render(<TagList tags={mockTags} />);

      mockTags.forEach((tag) => {
        expect(screen.getByText(tag)).toBeInTheDocument();
      });
    });

    it('should limit displayed tags when displayMax is provided', () => {
      const displayMax = 3;
      render(<TagList tags={mockTags} displayMax={displayMax} />);

      for (let i = 0; i < displayMax; i++) {
        expect(screen.getByText(mockTags[i])).toBeInTheDocument();
      }

      expect(screen.getByText(`+ ${mockTags.length - displayMax}`)).toBeInTheDocument();
    });

    it('should handle tag clicks correctly', async () => {
      const { user } = setup(<TagList tags={mockTags} onClick={mockOnClick} />);

      const firstTag = screen.getByText(mockTags[0]);
      await user.click(firstTag);

      expect(mockOnClick).toHaveBeenCalledWith(mockTags[0], expect.any(Object));
    });

    it('should apply custom aria labels when provided', () => {
      const getAriaLabel = (name: string, index: number) => `Custom label for ${name} at ${index}`;
      render(<TagList tags={mockTags} getAriaLabel={getAriaLabel} />);

      const firstTag = screen.getByLabelText('Custom label for tag1 at 0');
      expect(firstTag).toBeInTheDocument();
    });
  });

  describe('Tag', () => {
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

      const tag = screen.getByText('test-tag');
      expect(tag.tagName.toLowerCase()).toBe('button');
    });

    it('should render as span when onClick is not provided', () => {
      render(<Tag name="test-tag" />);

      const tag = screen.getByText('test-tag');
      expect(tag.tagName.toLowerCase()).toBe('span');
    });
  });
});
