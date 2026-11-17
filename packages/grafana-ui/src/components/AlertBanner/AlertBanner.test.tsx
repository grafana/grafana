import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import { Button } from '../Button/Button';

import { AlertActionButton } from './AlertActionButton';
import { AlertBanner } from './AlertBanner';

describe('AlertBanner', () => {
  it('sets the accessible label correctly based on the title if there is no aria-label set', () => {
    render(<AlertBanner title="Uh oh spagghettios!" />);
    expect(screen.getByRole('alert', { name: 'Uh oh spagghettios!' })).toBeInTheDocument();
  });

  it('prefers the aria-label attribute over the title if it is set', () => {
    render(<AlertBanner title="Uh oh spagghettios!" aria-label="A fancy label" />);
    expect(screen.queryByRole('alert', { name: 'Uh oh spagghettios!' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert', { name: 'A fancy label' })).toBeInTheDocument();
  });

  it('infers the role based on the severity in case it is not set manually', () => {
    render(<AlertBanner title="Error message" severity="error" />);
    expect(screen.getByRole('alert', { name: 'Error message' })).toBeInTheDocument();

    render(<AlertBanner title="Warning message" severity="warning" />);
    expect(screen.getByRole('alert', { name: 'Warning message' })).toBeInTheDocument();

    render(<AlertBanner title="Success message" severity="success" />);
    expect(screen.getByRole('status', { name: 'Success message' })).toBeInTheDocument();

    render(<AlertBanner title="Info message" severity="info" />);
    expect(screen.getByRole('status', { name: 'Info message' })).toBeInTheDocument();
  });

  it('is possible to set the role manually', () => {
    render(<AlertBanner title="Error message" severity="error" role="status" />);
    expect(screen.queryByRole('alert', { name: 'Error message' })).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Error message' })).toBeInTheDocument();
  });

  it('keeps the severity test id when a custom data-testid is passed', () => {
    render(<AlertBanner title="Warning message" severity="warning" data-testid="custom-id" />);
    const alert = screen.getByRole('alert', { name: 'Warning message' });
    expect(screen.getByTestId('custom-id')).toBe(alert);
    expect(alert).toContainElement(screen.getByTestId(selectors.components.Alert.alertV2('warning')));
  });

  describe('action prop', () => {
    it.each(['error', 'warning', 'info', 'success'] as const)(
      'renders the action of a %s alert banner as an AlertActionButton',
      (severity) => {
        render(
          <>
            <AlertBanner title="Test" severity={severity} action={jest.fn()} actionLabel="Action" />
            <AlertActionButton>Reference</AlertActionButton>
          </>
        );
        expect(screen.getByRole('button', { name: 'Action' })).toHaveClass(
          screen.getByRole('button', { name: 'Reference' }).className
        );
      }
    );

    it('renders no action button when action is not set', () => {
      render(<AlertBanner title="Quota exceeded" severity="warning" />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders both the action button and the dismiss button when onRemove is also set', () => {
      render(
        <AlertBanner
          title="Quota exceeded"
          severity="warning"
          action={jest.fn()}
          actionLabel="Request increase"
          onRemove={jest.fn()}
        />
      );
      expect(screen.getByRole('button', { name: 'Request increase' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /close alert/i })).toBeInTheDocument();
    });

    it('calls the action handler when the action button is clicked', async () => {
      const user = userEvent.setup();
      const onAction = jest.fn();
      render(<AlertBanner title="Test" severity="info" action={onAction} actionLabel="Do action" />);
      await user.click(screen.getByRole('button', { name: 'Do action' }));
      expect(onAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('button accessible names and onRemove', () => {
    it.each(['error', 'warning', 'info', 'success'] as const)(
      'renders buttonContent of a %s alert banner in a primary Button that calls onRemove',
      async (severity) => {
        const user = userEvent.setup();
        const onRemove = jest.fn();
        render(
          <>
            <AlertBanner title="Test" severity={severity} buttonContent="Dismiss" onRemove={onRemove} />
            <Button variant="primary">Reference</Button>
          </>
        );
        const dismiss = screen.getByRole('button', { name: 'Dismiss' });
        expect(dismiss).toHaveClass(screen.getByRole('button', { name: 'Reference' }).className);
        await user.click(dismiss);
        expect(onRemove).toHaveBeenCalledTimes(1);
      }
    );

    it('renders a Button passed as buttonContent as passed', () => {
      render(
        <>
          <AlertBanner title="Test" severity="error" buttonContent={<Button variant="secondary">Dismiss</Button>} />
          <Button variant="secondary">Reference</Button>
        </>
      );
      expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveClass(
        screen.getByRole('button', { name: 'Reference' }).className
      );
    });

    it('uses visible string buttonContent as the accessible name', () => {
      render(<AlertBanner title="Test" buttonContent="Go back" onRemove={jest.fn()} />);
      expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /close alert/i })).not.toBeInTheDocument();
    });

    it('uses visible element buttonContent as the accessible name', () => {
      render(<AlertBanner title="Test" buttonContent={<span>Go back</span>} onRemove={jest.fn()} />);
      expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /close alert/i })).not.toBeInTheDocument();
    });

    it('renders dismiss X icon when only onRemove is set and announces as Close alert', () => {
      render(<AlertBanner title="Test" onRemove={jest.fn()} />);
      expect(screen.getByRole('button', { name: /close alert/i })).toBeInTheDocument();
    });

    it('calls onRemove when the dismiss X icon is clicked', async () => {
      const user = userEvent.setup();
      const onRemove = jest.fn();
      render(<AlertBanner title="Test" onRemove={onRemove} />);
      await user.click(screen.getByRole('button', { name: /close alert/i }));
      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });
});
