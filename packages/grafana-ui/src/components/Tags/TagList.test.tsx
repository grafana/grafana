import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TagList } from './TagList';

const setup = (jsx: JSX.Element) => {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
};

const mockTags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'];
const mockOnClick = jest.fn();

describe('TagList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
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
