import { cache } from '@emotion/css';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'react';

import { createTheme, ThemeContext } from '@grafana/data';

import { getTagColor } from '../../utils/tags';

import { Tag } from './Tag';

// jsdom drops relative color values, so read the declarations Emotion registered for the element.
const getEmittedStyles = (element: HTMLElement) =>
  Array.from(element.classList, (className) => cache.registered[className] ?? '').join('');

const setup = (jsx: JSX.Element) => {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
};

const mockOnClick = jest.fn();

describe('Tag', () => {
  it.each(['dark', 'light'] as const)('uses a custom base color in %s mode ahead of the palette index', (mode) => {
    const theme = createTheme({ colors: { mode } });
    render(
      <ThemeContext.Provider value={theme}>
        <Tag name="error" baseColor="#ff0000" colorIndex={2} />
      </ThemeContext.Provider>
    );
    const { background, text } = getTagColor('#ff0000', theme);
    const styles = getEmittedStyles(screen.getByText('error'));
    expect(styles).toContain(`background-color:${background};`);
    expect(styles).toContain(`color:${text};`);
  });

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
});
