import { useForm } from 'react-hook-form';
import { render, screen } from 'test/test-utils';

import { config } from '@grafana/runtime';

import { type RepositoryFormData } from '../types';

import { WebhookSection } from './WebhookSection';

function Wrapper() {
  const { register, control } = useForm<RepositoryFormData>();
  return (
    <WebhookSection register={register} control={control} name="webhook.baseUrl" disabledName="webhook.disabled" />
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

  it('hides the learn more link on public instances', async () => {
    config.appUrl = 'https://grafana.example.com/';
    const { user } = render(<Wrapper />);

    await user.click(screen.getByText('Webhook options'));

    expect(screen.queryByRole('link', { name: 'Learn more' })).not.toBeInTheDocument();
  });
});
