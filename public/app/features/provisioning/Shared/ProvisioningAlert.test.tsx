import { Fragment, type PropsWithChildren } from 'react';
import { render, screen } from 'test/test-utils';

import { ProvisioningAlert } from './ProvisioningAlert';

const EmptyWrapper = ({ children }: PropsWithChildren) => <Fragment>{children}</Fragment>;

describe('ProvisioningAlert', () => {
  it('should render nothing when no alert data is provided', () => {
    const { container } = render(<ProvisioningAlert />, { wrapper: EmptyWrapper });
    expect(container).toBeEmptyDOMElement();
  });

  it('should render error alert with string message', () => {
    render(<ProvisioningAlert error="Something went wrong" />, { wrapper: EmptyWrapper });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should render error alert with StatusInfo object', () => {
    render(<ProvisioningAlert error={{ title: 'Error Title', message: 'Error message details' }} />, {
      wrapper: EmptyWrapper,
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Error Title')).toBeInTheDocument();
    expect(screen.getByText('Error message details')).toBeInTheDocument();
  });

  it('should render warning alert', () => {
    render(<ProvisioningAlert warning={['This is a warning']} />, { wrapper: EmptyWrapper });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('This is a warning')).toBeInTheDocument();
  });

  it('should render multiple warning alerts, each with its own action', async () => {
    const onClick = jest.fn();
    const { user } = render(
      <ProvisioningAlert
        warning={[
          { title: 'First warning', message: 'First message' },
          { title: 'Second warning', message: 'Second message', action: { label: 'Fix it', onClick } },
        ]}
      />,
      { wrapper: EmptyWrapper }
    );

    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.getByText('First warning')).toBeInTheDocument();
    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second warning')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();

    // Only the second warning has an action, so there's exactly one button (the Alert
    // component's own close button, labeled by its action text).
    const button = screen.getByRole('button');
    expect(screen.getByText('Fix it')).toBeInTheDocument();
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should render success alert', () => {
    render(<ProvisioningAlert success="Operation completed" />, { wrapper: EmptyWrapper });
    // Success alerts use role="status" per ARIA guidelines
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Operation completed')).toBeInTheDocument();
  });

  describe('action prop', () => {
    it('should render button action with onClick and call handler when clicked', async () => {
      const onClick = jest.fn();
      const { user } = render(<ProvisioningAlert error="Something went wrong" action={{ label: 'Retry', onClick }} />, {
        wrapper: EmptyWrapper,
      });

      // Alert component uses aria-label="Close alert" on the button
      const button = screen.getByRole('button');
      expect(screen.getByText('Retry')).toBeInTheDocument();
      await user.click(button);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should render button for href action and call window.open when clicked', async () => {
      const windowOpenSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

      const { user } = render(
        <ProvisioningAlert
          error={{ title: 'Quota exceeded', message: 'Upgrade to continue' }}
          action={{ label: 'Upgrade account', href: 'https://example.com/upgrade' }}
        />,
        { wrapper: EmptyWrapper }
      );

      const button = screen.getByRole('button');
      expect(screen.getByText('Upgrade account')).toBeInTheDocument();
      await user.click(button);
      expect(windowOpenSpy).toHaveBeenCalledWith('https://example.com/upgrade', '_blank');

      windowOpenSpy.mockRestore();
    });

    it('should render external link icon for external href action', () => {
      render(
        <ProvisioningAlert
          error="Quota exceeded"
          action={{ label: 'Upgrade', href: 'https://example.com', external: true }}
        />,
        { wrapper: EmptyWrapper }
      );

      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText('Upgrade')).toBeInTheDocument();
      // External links show the external-link-alt icon
      expect(document.querySelector('svg[id*="external-link-alt"]')).toBeInTheDocument();
    });
  });
});
