import 'core-js/stable/structured-clone';
import { FormProvider, useForm } from 'react-hook-form';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { render } from 'test/test-utils';
import { byRole, byTestId } from 'testing-library-selector';

import { grafanaAlertNotifiers } from 'app/features/alerting/unified/mockGrafanaNotifiers';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';

import { ChannelSubForm } from './ChannelSubForm';
import { GrafanaCommonChannelSettings } from './GrafanaCommonChannelSettings';
import { Notifier } from './notifiers';

type TestChannelValues = {
  __id: string;
  type: string;
  settings: Record<string, unknown>;
  secureFields: Record<string, boolean>;
};

type TestReceiverFormValues = {
  name: string;
  items: TestChannelValues[];
};

const ui = {
  typeSelector: byTestId('items.0.type'),
  settings: {
    webhook: {
      url: byRole('textbox', { name: /^URL/ }),
      optionalSettings: byRole('button', { name: /optional webhook settings/i }),
      title: {
        container: byTestId('items.0.settings.title'),
        input: byRole('textbox', { name: /^Title/ }),
      },
      message: {
        container: byTestId('items.0.settings.message'),
        input: byRole('textbox', { name: /^Message/ }),
      },
    },
    slack: {
      recipient: byTestId('items.0.settings.recipient'),
      token: byTestId('items.0.settings.token'),
      username: byTestId('items.0.settings.username'),
      webhookUrl: byRole('textbox', { name: /^Webhook URL/ }),
    },
    googlechat: {
      optionalSettings: byRole('button', { name: /optional google hangouts chat settings/i }),
      url: byRole('textbox', { name: /^URL/ }),
      title: {
        input: byRole('textbox', { name: /^Title/ }),
        container: byTestId('items.0.settings.title'),
      },
      message: {
        input: byRole('textbox', { name: /^Message/ }),
        container: byTestId('items.0.settings.message'),
      },
    },
  },
};

const notifiers: Notifier[] = [
  { dto: grafanaAlertNotifiers.webhook, meta: { enabled: true, order: 1 } },
  { dto: grafanaAlertNotifiers.slack, meta: { enabled: true, order: 2 } },
  { dto: grafanaAlertNotifiers.googlechat, meta: { enabled: true, order: 3 } },
  { dto: grafanaAlertNotifiers.sns, meta: { enabled: true, order: 4 } },
  { dto: grafanaAlertNotifiers.oncall, meta: { enabled: true, order: 5 } },
];

describe('ChannelSubForm', () => {
  function TestFormWrapper({ defaults, initial }: { defaults: TestChannelValues; initial?: TestChannelValues }) {
    const form = useForm<TestReceiverFormValues>({
      defaultValues: {
        name: 'test-contact-point',
        items: [defaults],
      },
    });

    return (
      <AlertmanagerProvider accessType="notification">
        <FormProvider {...form}>
          <ChannelSubForm
           defaultValues={{ ...defaults, secureSettings: {} }}
           initialValues={initial ? { ...initial, secureSettings: {} } : undefined}
           pathPrefix={`items.0.`}
           integrationIndex={0}
           notifiers={notifiers}
           onDuplicate={jest.fn()}
           commonSettingsComponent={GrafanaCommonChannelSettings}
           isEditable={true}
           isTestable={false}
           canEditProtectedFields={true}
          />
        </FormProvider>
      </AlertmanagerProvider>
    );
  }

  function renderForm(defaults: TestChannelValues, initial?: TestChannelValues) {
    return render(<TestFormWrapper defaults={defaults} initial={initial} />);
  }

  it('switching type hides prior fields and shows new ones', async () => {
    renderForm({
      __id: 'id-0',
      type: 'webhook',
      settings: { url: '' },
      secureFields: {},
    });

    expect(ui.typeSelector.get()).toHaveTextContent('Webhook');

    expect(ui.settings.webhook.url.get()).toBeInTheDocument();

    expect(ui.settings.slack.recipient.query()).not.toBeInTheDocument();

    await clickSelectOption(ui.typeSelector.get(), 'Slack');
    expect(ui.typeSelector.get()).toHaveTextContent('Slack');

    expect(ui.settings.slack.recipient.get()).toBeInTheDocument();
    expect(ui.settings.slack.token.get()).toBeInTheDocument();
    expect(ui.settings.slack.username.get()).toBeInTheDocument();
  });

  it('should clear secure fields when switching integration types', async () => {
    const googlechatDefaults: TestChannelValues = {
      __id: 'id-0',
      type: 'googlechat',
      settings: { title: 'Alert Title', message: 'Alert Message' },
      secureFields: { url: true },
    };

    const { user } = renderForm(googlechatDefaults, googlechatDefaults);

    expect(ui.typeSelector.get()).toHaveTextContent('Google Hangouts Chat');

    expect(ui.settings.googlechat.url.get()).toBeDisabled();
    expect(ui.settings.googlechat.url.get()).toHaveValue('configured');

    await user.click(ui.settings.googlechat.optionalSettings.get());

    expect(ui.settings.googlechat.title.input.get()).toHaveValue('Alert Title');
    expect(ui.settings.googlechat.message.input.get()).toHaveValue('Alert Message');

    await clickSelectOption(ui.typeSelector.get(), 'Webhook');
    expect(ui.typeSelector.get()).toHaveTextContent('Webhook');

    // Webhook URL field should now be present and empty (settings cleared)
    expect(ui.settings.webhook.url.get()).toHaveValue('');
    expect(ui.settings.webhook.title.container.get()).toBeInTheDocument();
    expect(ui.settings.webhook.message.container.get()).toBeInTheDocument();

    // If value for templated fields is empty the input should not be present
    expect(ui.settings.webhook.message.input.query()).not.toBeInTheDocument();
    expect(ui.settings.webhook.title.input.query()).not.toBeInTheDocument();
  });

  it('should clear settings when switching from webhook to googlechat', async () => {
    const webhookDefaults: TestChannelValues = {
      __id: 'id-0',
      type: 'webhook',
      settings: { url: 'https://example.com/webhook', title: 'Webhook Title', message: 'Webhook Message' },
      secureFields: {},
    };

    const { user } = renderForm(webhookDefaults, webhookDefaults);

    expect(ui.typeSelector.get()).toHaveTextContent('Webhook');

    expect(ui.settings.webhook.url.get()).toHaveValue('https://example.com/webhook');

    await user.click(ui.settings.webhook.optionalSettings.get());
    expect(ui.settings.webhook.title.input.get()).toHaveValue('Webhook Title');
    expect(ui.settings.webhook.message.input.get()).toHaveValue('Webhook Message');

    await clickSelectOption(ui.typeSelector.get(), 'Google Hangouts Chat');
    expect(ui.typeSelector.get()).toHaveTextContent('Google Hangouts Chat');

    // Google Chat URL field should now be present and empty (settings cleared)
    expect(ui.settings.googlechat.url.get()).toHaveValue('');
    expect(ui.settings.googlechat.title.container.get()).toBeInTheDocument();
    expect(ui.settings.googlechat.message.container.get()).toBeInTheDocument();

    // If value for templated fields is empty the input should not be present
    expect(ui.settings.googlechat.message.input.query()).not.toBeInTheDocument();
    expect(ui.settings.googlechat.title.input.query()).not.toBeInTheDocument();
  });

  it('should restore initial values when switching back to original type', async () => {
    const googlechatDefaults: TestChannelValues = {
      __id: 'id-0',
      type: 'googlechat',
      settings: { title: 'Original Title', message: 'Original Message' },
      secureFields: { url: true },
    };

    const { user } = renderForm(googlechatDefaults, googlechatDefaults);

    expect(ui.typeSelector.get()).toHaveTextContent('Google Hangouts Chat');

    expect(ui.settings.googlechat.url.get()).toBeDisabled();
    expect(ui.settings.googlechat.url.get()).toHaveValue('configured');

    await user.click(ui.settings.googlechat.optionalSettings.get());

    expect(ui.settings.googlechat.title.input.get()).toHaveValue('Original Title');
    expect(ui.settings.googlechat.message.input.get()).toHaveValue('Original Message');

    // Switch to a different type
    await clickSelectOption(ui.typeSelector.get(), 'Webhook');
    expect(ui.typeSelector.get()).toHaveTextContent('Webhook');
    expect(ui.settings.webhook.url.get()).toHaveValue('');

    // Switch back to the original type
    await clickSelectOption(ui.typeSelector.get(), 'Google Hangouts Chat');
    expect(ui.typeSelector.get()).toHaveTextContent('Google Hangouts Chat');

    // Original settings and secure fields should be restored
    expect(ui.settings.googlechat.url.get()).toBeDisabled();
    expect(ui.settings.googlechat.url.get()).toHaveValue('configured');

    expect(ui.settings.googlechat.title.input.get()).toHaveValue('Original Title');
    expect(ui.settings.googlechat.message.input.get()).toHaveValue('Original Message');
  });

  it('should maintain secure field isolation across multiple type switches', async () => {
    const googlechatDefaults: TestChannelValues = {
      __id: 'id-0',
      type: 'googlechat',
      settings: {},
      secureFields: { url: true },
    };

    renderForm(googlechatDefaults, googlechatDefaults);

    expect(ui.typeSelector.get()).toHaveTextContent('Google Hangouts Chat');
    expect(ui.settings.googlechat.url.get()).toBeDisabled();
    expect(ui.settings.googlechat.url.get()).toHaveValue('configured');

    // Switch to Slack
    await clickSelectOption(ui.typeSelector.get(), 'Slack');
    expect(ui.typeSelector.get()).toHaveTextContent('Slack');

    // Slack should not have any secure fields from Google Chat
    const slackUrl = ui.settings.slack.webhookUrl.get();
    expect(slackUrl).toBeEnabled();
    expect(slackUrl).toHaveValue('');
  });
});
