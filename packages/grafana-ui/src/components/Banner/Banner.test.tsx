import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme, ThemeContext } from '@grafana/data';

import { Button } from '../Button/Button';

import { Banner, type BannerProps } from './Banner';
import { getOpaqueBackgroundColor } from './Banner.styles';
import { BannerDismissButton } from './BannerDismissButton';

const defaultProps: Pick<BannerProps, 'role' | 'icon' | 'backgroundColor' | 'borderColor' | 'iconColor' | 'textColor'> =
  {
    role: 'alert',
    icon: 'exclamation-circle',
    backgroundColor: 'rgba(209, 14, 92, 0.15)',
    borderColor: 'rgba(209, 14, 92, 0.25)',
    iconColor: '#d10e5c',
    textColor: '#222426',
  };

describe('Banner', () => {
  it('sets the accessible label correctly based on the title if there is no aria-label set', () => {
    render(<Banner {...defaultProps} title="Uh oh spagghettios!" />);
    expect(screen.getByRole('alert', { name: 'Uh oh spagghettios!' })).toBeInTheDocument();
  });

  it('prefers the aria-label attribute over the title if it is set', () => {
    render(<Banner {...defaultProps} title="Uh oh spagghettios!" aria-label="A fancy label" />);
    expect(screen.queryByRole('alert', { name: 'Uh oh spagghettios!' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert', { name: 'A fancy label' })).toBeInTheDocument();
  });

  it('applies the role it is given', () => {
    render(<Banner {...defaultProps} title="Info message" role="status" />);
    expect(screen.getByRole('status', { name: 'Info message' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('uses 8px 16px padding by default and 4px 12px when isCompact is set', () => {
    const { rerender } = render(<Banner {...defaultProps} title="Test" dataTestId="container" />);
    expect(screen.getByTestId('container')).toHaveStyle({ padding: '8px 16px' });

    rerender(<Banner {...defaultProps} title="Test" dataTestId="container" isCompact />);
    expect(screen.getByTestId('container')).toHaveStyle({ padding: '4px 12px' });
  });

  it('applies dataTestId to the inner container and keeps a passed-through data-testid on the outer element', () => {
    render(<Banner {...defaultProps} title="Test" dataTestId="inner-id" data-testid="outer-id" />);
    const outer = screen.getByRole('alert');
    expect(screen.getByTestId('outer-id')).toBe(outer);
    expect(screen.getByTestId('inner-id')).not.toBe(outer);
    expect(outer).toContainElement(screen.getByTestId('inner-id'));
  });

  it('replaces the icon with a loading spinner when isLoading is set', () => {
    render(<Banner {...defaultProps} title="Loading data" isLoading />);
    expect(screen.getByRole('alert')).toContainElement(screen.getByTestId('Spinner'));
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('hides the dismiss X icon while loading', () => {
    render(<Banner {...defaultProps} title="Loading data" isLoading onRemove={jest.fn()} />);
    expect(screen.queryByRole('button', { name: /close alert/i })).not.toBeInTheDocument();
  });

  it('hides the buttonContent dismiss button while loading', () => {
    render(<Banner {...defaultProps} title="Loading data" isLoading onRemove={jest.fn()} buttonContent="Not now" />);
    expect(screen.queryByRole('button', { name: 'Not now' })).not.toBeInTheDocument();
  });

  describe('without a role', () => {
    const { role, ...propsWithoutRole } = defaultProps;

    it('is a section landmark named by its title, and not a live region', () => {
      render(<Banner {...propsWithoutRole} title="Try the new editor" />);
      expect(screen.getByRole('region', { name: 'Try the new editor' })).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('names the section with aria-label when it is set', () => {
      render(<Banner {...propsWithoutRole} title="Try the new editor" aria-label="New editor" />);
      expect(screen.getByRole('region', { name: 'New editor' })).toBeInTheDocument();
    });
  });

  it('renders no spinner by default', () => {
    render(<Banner {...defaultProps} title="Test" />);
    expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
  });

  it('renders no icon tile without an icon', () => {
    const { icon, ...propsWithoutIcon } = defaultProps;
    render(<Banner {...propsWithoutIcon} title="Test" />);
    expect(screen.queryByTestId('icon-exclamation-circle')).not.toBeInTheDocument();
    // The inner container's first child is the title block, not an empty icon tile.
    expect(screen.getByRole('alert').firstElementChild?.firstElementChild).toHaveTextContent('Test');
  });

  it('shows the spinner without an icon while loading', () => {
    const { icon, ...propsWithoutIcon } = defaultProps;
    render(<Banner {...propsWithoutIcon} title="Test" isLoading />);
    expect(screen.getByTestId('Spinner')).toBeInTheDocument();
  });

  describe('action prop', () => {
    it('renders the provided action element', () => {
      render(
        <Banner
          {...defaultProps}
          title="Quota exceeded"
          action={<Button onClick={jest.fn()}>Request increase</Button>}
        />
      );
      expect(screen.getByRole('button', { name: 'Request increase' })).toBeInTheDocument();
    });

    it('renders both action element and dismiss button when onRemove is also set', () => {
      render(
        <Banner
          {...defaultProps}
          title="Quota exceeded"
          action={<Button onClick={jest.fn()}>Request increase</Button>}
          onRemove={jest.fn()}
        />
      );
      expect(screen.getByRole('button', { name: 'Request increase' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /close alert/i })).toBeInTheDocument();
    });

    it('calls the action handler when clicked', async () => {
      const user = userEvent.setup();
      const onAction = jest.fn();
      render(<Banner {...defaultProps} title="Test" action={<Button onClick={onAction}>Do action</Button>} />);
      await user.click(screen.getByRole('button', { name: 'Do action' }));
      expect(onAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('button accessible names and onRemove', () => {
    it('uses visible string buttonContent as the accessible name', () => {
      render(<Banner {...defaultProps} title="Test" buttonContent="Go back" onRemove={jest.fn()} />);
      expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /close alert/i })).not.toBeInTheDocument();
    });

    it('uses visible element buttonContent as the accessible name', () => {
      render(<Banner {...defaultProps} title="Test" buttonContent={<span>Go back</span>} onRemove={jest.fn()} />);
      expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /close alert/i })).not.toBeInTheDocument();
    });

    it('wraps buttonContent that is not a Button in a button that calls onRemove', async () => {
      const user = userEvent.setup();
      const onRemove = jest.fn();
      render(<Banner {...defaultProps} title="Test" onRemove={onRemove} buttonContent={<span>Dismiss</span>} />);
      await user.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('colors the wrapping button with dismissButtonBackgroundColor and dismissButtonTextColor', () => {
      render(
        <Banner
          {...defaultProps}
          title="Test"
          dismissButtonBackgroundColor="rgb(61, 113, 217)"
          dismissButtonTextColor="rgb(255, 255, 255)"
          onRemove={jest.fn()}
          buttonContent={<span>Dismiss</span>}
        />
      );
      expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveStyle({
        backgroundColor: 'rgb(61, 113, 217)',
        color: 'rgb(255, 255, 255)',
      });
    });

    it('colors the wrapping button with iconColor and backgroundColor by default in the refresh themes', () => {
      const theme = createTheme();
      theme.flags = { ...theme.flags, visualDesignRefresh: true };
      render(
        <ThemeContext.Provider value={theme}>
          <Banner
            {...defaultProps}
            title="Test"
            backgroundColor="rgb(31, 22, 0)"
            iconColor="rgb(192, 142, 46)"
            onRemove={jest.fn()}
            buttonContent={<span>Dismiss</span>}
          />
        </ThemeContext.Provider>
      );
      expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveStyle({
        backgroundColor: 'rgb(192, 142, 46)',
        color: 'rgb(31, 22, 0)',
      });
    });

    it('uses an opaque version of backgroundColor for the wrapping button text by default in the other themes', () => {
      const theme = createTheme();
      render(
        <ThemeContext.Provider value={theme}>
          <Banner {...defaultProps} title="Test" onRemove={jest.fn()} buttonContent={<span>Dismiss</span>} />
          <BannerDismissButton
            backgroundColor={defaultProps.iconColor}
            textColor={getOpaqueBackgroundColor(theme, defaultProps.backgroundColor)}
          >
            Reference
          </BannerDismissButton>
        </ThemeContext.Provider>
      );
      expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveClass(
        screen.getByRole('button', { name: 'Reference' }).className
      );
    });

    it('renders dismiss X icon when only onRemove is set and announces as Close alert', () => {
      render(<Banner {...defaultProps} title="Test" onRemove={jest.fn()} />);
      expect(screen.getByRole('button', { name: /close alert/i })).toBeInTheDocument();
    });

    it('calls onRemove when the dismiss X icon is clicked', async () => {
      const user = userEvent.setup();
      const onRemove = jest.fn();
      render(<Banner {...defaultProps} title="Test" onRemove={onRemove} />);
      await user.click(screen.getByRole('button', { name: /close alert/i }));
      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });
});
