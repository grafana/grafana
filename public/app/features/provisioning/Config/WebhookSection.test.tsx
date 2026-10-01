import { useForm } from 'react-hook-form';
import { render, screen } from 'test/test-utils';

import { config } from '@grafana/runtime';

import { type RepositoryFormData } from '../types';

import { WebhookSection } from './WebhookSection';

function Wrapper({
  connectionWebhookDisabled,
  disabledReason,
}: {
  connectionWebhookDisabled?: boolean;
  disabledReason?: string;
}) {
  const { register, control } = useForm<RepositoryFormData>();
  return (
    <WebhookSection
      register={register}
      control={control}
      name="webhook.baseUrl"
      disabledName="webhook.disabled"
      connectionWebhookDisabled={connectionWebhookDisabled}
      disabledReason={disabledReason}
    />
  );
}

describe('WebhookSection', () => {
  let originalAppUrl: string;

  beforeEach(() => {
    originalAppUrl = config.appUrl;
  });

  afterEach(() => {
    config.appUrl = originalAppUrl;
  });

  it('renders collapsed by default, hiding the webhook URL field', () => {
    render(<Wrapper />);

    expect(screen.getByText('Webhook options')).toBeInTheDocument();
    expect(screen.queryByText('Webhook URL')).not.toBeInTheDocument();
  });

  it('renders the disable webhook checkbox under webhook.disabled when expanded', async () => {
    const { user } = render(<Wrapper />);

    await user.click(screen.getByText('Webhook options'));

    expect(screen.getByText('Disable webhook integration')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /disable webhook integration/i })).toHaveAttribute(
      'name',
      'webhook.disabled'
    );
  });

  it('registers the webhook URL input under webhook.baseUrl when expanded', async () => {
    const { user } = render(<Wrapper />);

    await user.click(screen.getByText('Webhook options'));

    expect(screen.getByText('Webhook URL')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('name', 'webhook.baseUrl');
  });

  it('disables the webhook URL input when the disable checkbox is checked', async () => {
    const { user } = render(<Wrapper />);

    await user.click(screen.getByText('Webhook options'));
    await user.click(screen.getByRole('checkbox', { name: /disable webhook integration/i }));

    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('shows the learn more link on private instances', async () => {
    config.appUrl = 'http://localhost:3000/';
    const { user } = render(<Wrapper />);

    await user.click(screen.getByText('Webhook options'));

    expect(screen.getByRole('link', { name: 'Learn more' })).toBeInTheDocument();
  });

  describe('connectionWebhookDisabled', () => {
    it('disables the checkbox when connectionWebhookDisabled is true', async () => {
      const { user } = render(<Wrapper connectionWebhookDisabled={true} />);

      await user.click(screen.getByText('Webhook options'));

      expect(screen.getByRole('checkbox', { name: /disable webhook integration/i })).toBeDisabled();
    });

    it('disables the URL input when connectionWebhookDisabled is true', async () => {
      const { user } = render(<Wrapper connectionWebhookDisabled={true} />);

      await user.click(screen.getByText('Webhook options'));

      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('enables the checkbox and shows the normal description when connectionWebhookDisabled is false', async () => {
      const { user } = render(<Wrapper connectionWebhookDisabled={false} />);

      await user.click(screen.getByText('Webhook options'));

      expect(screen.getByRole('checkbox', { name: /disable webhook integration/i })).not.toBeDisabled();
      expect(
        screen.getByText(/when checked, grafana will not register or receive webhook events/i)
      ).toBeInTheDocument();
    });

    it('shows the forced description when connectionWebhookDisabled is true', async () => {
      const { user } = render(<Wrapper connectionWebhookDisabled={true} />);

      await user.click(screen.getByText('Webhook options'));

      expect(screen.getByText(/disabled because the referenced github app connection/i)).toBeInTheDocument();
    });
  });

  describe('disabledReason', () => {
    it('restores the stored value when the disabled reason goes away', async () => {
      const { user, rerender } = render(<Wrapper />);

      await user.click(screen.getByText('Webhook options'));
      expect(screen.getByRole('checkbox', { name: /disable webhook integration/i })).not.toBeChecked();

      rerender(<Wrapper disabledReason="Webhooks need an email." />);
      expect(screen.getByRole('checkbox', { name: /disable webhook integration/i })).toBeChecked();

      rerender(<Wrapper />);
      expect(screen.getByRole('checkbox', { name: /disable webhook integration/i })).not.toBeChecked();
    });

    it('disables the checkbox and URL input and shows the reason', async () => {
      const { user } = render(<Wrapper disabledReason="Webhooks need an email." />);

      await user.click(screen.getByText('Webhook options'));

      expect(screen.getByRole('checkbox', { name: /disable webhook integration/i })).toBeDisabled();
      expect(screen.getByRole('checkbox', { name: /disable webhook integration/i })).toBeChecked();
      expect(screen.getByRole('textbox')).toBeDisabled();
      expect(screen.getByText('Webhooks need an email.')).toBeInTheDocument();
    });
  });

  it('hides the learn more link on public instances', async () => {
    config.appUrl = 'https://grafana.example.com/';
    const { user } = render(<Wrapper />);

    await user.click(screen.getByText('Webhook options'));

    expect(screen.queryByRole('link', { name: 'Learn more' })).not.toBeInTheDocument();
  });
});
