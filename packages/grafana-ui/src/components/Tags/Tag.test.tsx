import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CSSProperties, JSX } from 'react';

import { createTheme, ThemeContext } from '@grafana/data';

import { getTagColorVariables } from '../../utils/tags';

import { Tag } from './Tag';

const getColorVariables = (element: HTMLElement) => ({
  '--tag-background': element.style.getPropertyValue('--tag-background'),
  '--tag-text': element.style.getPropertyValue('--tag-text'),
});

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
    expect(getColorVariables(screen.getByText('error'))).toEqual({
      '--tag-background': 'rgb(from #ff0000 r g b / 1)',
      '--tag-text': getTagColorVariables('#ff0000', theme)['--tag-text'],
    });
  });

  it('uses the theme palette for a color index', () => {
    const theme = createTheme();
    render(
      <ThemeContext.Provider value={theme}>
        <Tag name="error" colorIndex={2} />
      </ThemeContext.Provider>
    );
    const { background, text } = theme.components.tag.colors[2];
    expect(getColorVariables(screen.getByText('error'))).toEqual({
      '--tag-background': background,
      '--tag-text': text,
    });
  });

  it('shares one class across tag colors', () => {
    render(
      <>
        <Tag name="red" baseColor="#ff0000" />
        <Tag name="blue" baseColor="#0000ff" />
        <Tag name="palette" colorIndex={3} />
        <Tag name="hashed" />
      </>
    );
    const classNames = new Set(['red', 'blue', 'palette', 'hashed'].map((name) => screen.getByText(name).className));
    expect(classNames.size).toBe(1);
  });

  it('lets a passed style override the tag colors', () => {
    render(<Tag name="error" baseColor="#ff0000" style={{ '--tag-text': 'black' } as CSSProperties} />);
    expect(getColorVariables(screen.getByText('error'))['--tag-text']).toBe('black');
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
