import { css } from '@emotion/css';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, type CSSProperties, type JSX } from 'react';

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
  it('exposes the native disabled state without adding wrapper ARIA', () => {
    const onRemove = jest.fn();
    const { rerender } = render(<Tag name="service" title="Tag details" onRemove={onRemove} />);

    expect(screen.getByTitle('Tag details')).toHaveTextContent('service');
    expect(screen.getByTitle('Tag details')).not.toHaveAttribute('aria-disabled');

    rerender(<Tag name="service" title="Tag details" onRemove={onRemove} disabled />);

    expect(screen.getByRole('button', { name: 'Remove tag: service' })).toBeDisabled();
    expect(screen.getByTitle('Tag details')).not.toHaveAttribute('aria-disabled');
  });

  it.each([false, true])('preserves custom ARIA attributes when removable is %s', (removable) => {
    const props = {
      name: 'service',
      title: 'Tag details',
      onRemove: removable ? jest.fn() : undefined,
      'aria-disabled': false,
      'aria-describedby': 'tag-description',
    };
    const { rerender } = render(<Tag {...props} />);

    expect(screen.getByTitle('Tag details')).toHaveAttribute('aria-disabled', 'false');
    expect(screen.getByTitle('Tag details')).toHaveAttribute('aria-describedby', 'tag-description');

    rerender(<Tag {...props} disabled />);

    expect(screen.getByTitle('Tag details')).toHaveAttribute('aria-disabled', 'false');
    expect(screen.getByTitle('Tag details')).toHaveAttribute('aria-describedby', 'tag-description');
  });

  it('ignores disabled on static tags', () => {
    const theme = createTheme();
    render(
      <ThemeContext.Provider value={theme}>
        <Tag name="service" colorIndex={0} disabled />
      </ThemeContext.Provider>
    );

    expect(screen.getByText('service')).not.toHaveStyle({ color: theme.colors.text.disabled });
    expect(getColorVariables(screen.getByText('service'))).toEqual(getTagColorVariables(0, theme));
    expect(screen.getByText('service')).not.toHaveAttribute('aria-disabled');
  });

  it('preserves consumer style overrides for removable and disabled tags', () => {
    render(
      <Tag
        name="service"
        title="Custom tag"
        disabled
        onRemove={jest.fn()}
        className={css({ gap: '12px', color: 'rgb(1, 2, 3)' })}
      />
    );

    expect(screen.getByTitle('Custom tag')).toHaveStyle({ gap: '12px', color: 'rgb(1, 2, 3)' });
  });

  it.each([{ 'aria-label': 'Open service' }, { 'aria-labelledby': 'service-label' }])(
    'preserves the label action accessible name with %o',
    (labelProps) => {
      render(
        <>
          <span id="service-label">Open service</span>
          <Tag name="service" onClick={jest.fn()} onRemove={jest.fn()} {...labelProps} />
        </>
      );

      expect(screen.getByRole('button', { name: 'Open service' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Remove tag: service' })).toBeEnabled();
    }
  );

  it('uses theme disabled text without dimming the tag background', () => {
    const theme = createTheme();
    render(
      <ThemeContext.Provider value={theme}>
        <Tag name="service" title="Disabled tag" colorIndex={0} disabled onRemove={jest.fn()} />
      </ThemeContext.Provider>
    );

    expect(screen.getByTitle('Disabled tag')).toHaveStyle({
      color: theme.colors.text.disabled,
    });
    expect(getColorVariables(screen.getByTitle('Disabled tag'))['--tag-background']).toBe(
      theme.components.tag.colors[0].background
    );
    expect(screen.getByTitle('Disabled tag')).not.toHaveStyle({ opacity: 0.5 });
    expect(screen.getByRole('button', { name: 'Remove tag: service' })).toBeDisabled();
  });

  it.each([false, true])('forwards the ref and attributes to the root when removable is %s', (removable) => {
    const ref = createRef<HTMLElement>();
    render(
      <Tag
        ref={ref}
        name="service"
        title="Tag details"
        onClick={jest.fn()}
        onRemove={removable ? jest.fn() : undefined}
      />
    );

    expect(ref.current).toBe(screen.getByTitle('Tag details'));
    expect(ref.current?.tagName).toBe(removable ? 'SPAN' : 'BUTTON');
  });

  it('isolates removal from an enclosing click action and form submission', async () => {
    const onRemove = jest.fn();
    const onParentClick = jest.fn();
    const onSubmit = jest.fn((event) => event.preventDefault());
    const { user } = setup(
      <form onSubmit={onSubmit} onClick={onParentClick}>
        <Tag name="service" onRemove={onRemove} />
      </form>
    );

    await user.click(screen.getByRole('button', { name: 'Remove tag: service' }));

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onParentClick).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([false, true])('disables actions and skips tab stops when removable is %s', async (removable) => {
    const onClick = jest.fn();
    const onRemove = jest.fn();
    const { user } = setup(
      <>
        <Tag name="service" onClick={onClick} onRemove={removable ? onRemove : undefined} disabled />
        <button>Next</button>
      </>
    );

    const label = screen.getByRole('button', { name: 'service' });
    expect(label).toBeDisabled();
    await user.click(label);
    if (removable) {
      const remove = screen.getByRole('button', { name: 'Remove tag: service' });
      expect(remove).toBeDisabled();
      await user.click(remove);
    }
    await user.tab();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
    expect(onClick).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it.each(['{Enter}', ' '])('activates label and remove independently with %s', async (key) => {
    const onClick = jest.fn();
    const onRemove = jest.fn();
    const { user } = setup(<Tag name="service" icon="info-circle" onClick={onClick} onRemove={onRemove} />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'service' })).toHaveFocus();
    await user.keyboard(key);
    expect(onClick).toHaveBeenCalledWith('service', expect.any(Object));
    expect(onRemove).not.toHaveBeenCalled();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Remove tag: service' })).toHaveFocus();
    await user.keyboard(key);
    expect(onRemove).toHaveBeenCalledWith('service', expect.any(Object));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('removes a tag through its named close button', async () => {
    const onRemove = jest.fn();
    const { user } = setup(<Tag name="service" onRemove={onRemove} />);

    await user.click(screen.getByRole('button', { name: 'Remove tag: service' }));

    expect(onRemove).toHaveBeenCalledWith('service', expect.any(Object));
  });

  it.each(['dark', 'light'] as const)('uses a custom base color in %s mode ahead of the palette index', (mode) => {
    const theme = createTheme({ colors: { mode } });
    render(
      <ThemeContext.Provider value={theme}>
        <Tag name="error" baseColor="#ff0000" colorIndex={2} />
      </ThemeContext.Provider>
    );
    expect(getColorVariables(screen.getByText('error'))).toEqual({
      '--tag-background': 'rgb(from #ff0000 r g b / clamp(0, alpha * 1e9, 1))',
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

  it('renders a clickable tag as a non-submit button inside a form', () => {
    render(
      <form>
        <Tag name="service" onClick={jest.fn()} />
      </form>
    );

    expect(screen.getByRole('button', { name: 'service' })).toHaveProperty('type', 'button');
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
