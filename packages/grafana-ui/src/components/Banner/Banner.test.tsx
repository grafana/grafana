import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Button } from '../Button/Button';

import { Banner, type BannerProps } from './Banner';

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

  it('renders no spinner by default', () => {
    render(<Banner {...defaultProps} title="Test" />);
    expect(screen.queryByTestId('Spinner')).not.toBeInTheDocument();
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

    it('renders a Button passed as buttonContent directly, with its own click handler', async () => {
      const user = userEvent.setup();
      const onClick = jest.fn();
      const onRemove = jest.fn();
      render(
        <>
          <Banner
            {...defaultProps}
            title="Test"
            onRemove={onRemove}
            buttonContent={
              <Button variant="destructive" fill="outline" onClick={onClick}>
                Dismiss
              </Button>
            }
          />
          <Button variant="destructive" fill="outline">
            Reference
          </Button>
        </>
      );
      const dismiss = screen.getByRole('button', { name: 'Dismiss' });
      expect(dismiss).toHaveClass(screen.getByRole('button', { name: 'Reference' }).className);
      expect(within(screen.getByRole('alert')).getAllByRole('button')).toHaveLength(1);

      await user.click(dismiss);
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onRemove).not.toHaveBeenCalled();
    });

    it('renders a Button passed as buttonContent even without onRemove', () => {
      render(<Banner {...defaultProps} title="Test" buttonContent={<Button>Dismiss</Button>} />);
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    });

    it('wraps buttonContent that is not a Button in a secondary Button that calls onRemove', async () => {
      const user = userEvent.setup();
      const onRemove = jest.fn();
      render(
        <>
          <Banner {...defaultProps} title="Test" onRemove={onRemove} buttonContent={<span>Dismiss</span>} />
          <Button variant="secondary">Reference</Button>
        </>
      );
      const dismiss = screen.getByRole('button', { name: 'Dismiss' });
      expect(dismiss).toHaveClass(screen.getByRole('button', { name: 'Reference' }).className);
      await user.click(dismiss);
      expect(onRemove).toHaveBeenCalledTimes(1);
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
