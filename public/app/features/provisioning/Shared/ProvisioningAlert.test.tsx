import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ProvisioningAlert } from './ProvisioningAlert';

function setup(jsx: JSX.Element) {
  return { user: userEvent.setup(), ...render(jsx) };
}

describe('ProvisioningAlert', () => {
  it('should render nothing when no alert data is provided', () => {
    const { container } = render(<ProvisioningAlert />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render error alert with string message', () => {
    render(<ProvisioningAlert error="Something went wrong" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should render error alert with StatusInfo object', () => {
    render(<ProvisioningAlert error={{ title: 'Error Title', message: 'Error message details' }} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Error Title')).toBeInTheDocument();
    expect(screen.getByText('Error message details')).toBeInTheDocument();
  });

  it('should render warning alert', () => {
    render(<ProvisioningAlert warning="This is a warning" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('This is a warning')).toBeInTheDocument();
  });

  it('should render success alert', () => {
    render(<ProvisioningAlert success="Operation completed" />);
    // Success alerts use role="status" per ARIA guidelines
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Operation completed')).toBeInTheDocument();
  });

  describe('action prop', () => {
    it('should render button action with onClick and call handler when clicked', async () => {
      const onClick = jest.fn();
      const { user } = setup(<ProvisioningAlert error="Something went wrong" action={{ label: 'Retry', onClick }} />);

      expect(screen.getByText('Retry')).toBeInTheDocument();

      const button = screen.getByRole('button');
      await user.click(button);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should render button for href action and call window.open when clicked', async () => {
      const windowOpenSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

      const { user } = setup(
        <ProvisioningAlert
          error={{ title: 'Quota exceeded', message: 'Upgrade to continue' }}
          action={{ label: 'Upgrade account', href: 'https://example.com/upgrade' }}
        />
      );

      expect(screen.getByText('Upgrade account')).toBeInTheDocument();

      const button = screen.getByRole('button');
      await user.click(button);
      expect(windowOpenSpy).toHaveBeenCalledWith('https://example.com/upgrade', '_blank');

      windowOpenSpy.mockRestore();
    });

    it('should render external link icon for external href action', () => {
      render(
        <ProvisioningAlert
          error="Quota exceeded"
          action={{ label: 'Upgrade', href: 'https://example.com', external: true }}
        />
      );

      expect(screen.getByText('Upgrade')).toBeInTheDocument();
      // External links show the external-link-alt icon
      expect(document.querySelector('svg[id*="external-link-alt"]')).toBeInTheDocument();
    });
  });
});
