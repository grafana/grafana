import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type IconName, type LinkModel } from '@grafana/data';

import { SingleValue } from './LogLineOTelDetailsFields';

interface TestLink extends LinkModel {
  icon?: IconName;
}

function createLink(overrides: Partial<TestLink> = {}): TestLink {
  return {
    href: 'https://example.com/service',
    title: 'Open in APM',
    target: '_blank',
    origin: undefined,
    ...overrides,
  };
}

describe('SingleValue', () => {
  it('renders the value without a link when there are no links', () => {
    render(<SingleValue value="checkout-service" />);

    expect(screen.getByText('checkout-service')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('wraps the value in a single link when there is one link', () => {
    render(<SingleValue value="checkout-service" links={[createLink()]} />);

    const link = screen.getByRole('link', { name: 'Open in APM' });
    expect(link).toHaveAttribute('href', 'https://example.com/service');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveTextContent('checkout-service');
    expect(link.querySelector('svg')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onLinkClick when the single link is clicked', async () => {
    const user = userEvent.setup();
    const onLinkClick = jest.fn();
    const onClick = jest.fn();
    const link = createLink({ onClick });

    render(<SingleValue value="checkout-service" links={[link]} onLinkClick={onLinkClick} />);

    await user.click(screen.getByRole('link', { name: 'Open in APM' }));

    expect(onLinkClick).toHaveBeenCalledWith(link);
    expect(onClick).toHaveBeenCalled();
  });

  it('shows a dropdown instead of individual links when there are multiple links', async () => {
    const user = userEvent.setup();

    render(
      <SingleValue
        value="checkout-service"
        links={[
          createLink({ href: 'https://example.com/apm', title: 'APM', icon: 'compass' }),
          createLink({ href: 'https://example.com/k8s', title: 'Kubernetes', icon: 'apps' }),
        ]}
      />
    );

    expect(screen.queryByRole('link', { name: 'APM' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Kubernetes' })).not.toBeInTheDocument();
    expect(screen.getByText('checkout-service')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'checkout-service' }));

    expect(await screen.findByText('OPEN VALUE IN')).toBeInTheDocument();
    expect(await screen.findByRole('menuitem', { name: 'APM' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Kubernetes' })).toBeInTheDocument();
    expect(screen.getByTitle('APM')).toBeInTheDocument();
    expect(screen.getByTitle('Kubernetes')).toBeInTheDocument();
  });

  it('opens the dropdown when clicking the attribute value text', async () => {
    const user = userEvent.setup();

    render(
      <SingleValue
        value="checkout-service"
        links={[
          createLink({ href: 'https://example.com/apm', title: 'APM' }),
          createLink({ href: 'https://example.com/k8s', title: 'Kubernetes' }),
        ]}
      />
    );

    await user.click(screen.getByText('checkout-service'));

    expect(await screen.findByRole('menuitem', { name: 'APM' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Kubernetes' })).toBeInTheDocument();
  });

  it('calls onLinkClick when a dropdown menu link is clicked', async () => {
    const user = userEvent.setup();
    const onLinkClick = jest.fn();
    const onClick = jest.fn();
    const apmLink = createLink({ href: 'https://example.com/apm', title: 'APM', onClick });
    const k8sLink = createLink({ href: 'https://example.com/k8s', title: 'Kubernetes' });

    render(<SingleValue value="checkout-service" links={[apmLink, k8sLink]} onLinkClick={onLinkClick} />);

    await user.click(screen.getByRole('button', { name: 'checkout-service' }));
    await user.click(await screen.findByRole('menuitem', { name: 'APM' }));

    expect(onLinkClick).toHaveBeenCalledWith(apmLink);
    expect(onClick).toHaveBeenCalled();
  });
});
