import 'core-js/stable/structured-clone';
import { FormProvider, useForm } from 'react-hook-form';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { render, waitFor } from 'test/test-utils';
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
    },
    googlechat: {
      optionalSettings: byRole('button', { name: /optional google hangouts chat settings/i }),
      url: byRole('textbox', { name: /^URL/ }),
      title: {
        input: byRole('textbox', { name: /^Title/ }),
      },
      message: {
        input: byRole('textbox', { name: /^Message/ }),
      },
    },
  },
};

// Use real notifiers from mockGrafanaNotifiers
const notifiers: Notifier[] = [
  {
    dto: grafanaAlertNotifiers.webhook,
    meta: { enabled: true, order: 1 },
  },
  {
    dto: grafanaAlertNotifiers.slack,
    meta: { enabled: true, order: 2 },
  },
  {
    dto: grafanaAlertNotifiers.googlechat,
    meta: { enabled: true, order: 3 },
  },
];

// Don't mock CollapsibleSection - use the real component to ensure proper re-rendering behavior

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
            defaultValues={defaults}
            initialValues={initial}
            pathPrefix={`items.0.`}
            integrationIndex={0}
            notifiers={notifiers}
            onDuplicate={jest.fn()}
            commonSettingsComponent={GrafanaCommonChannelSettings}
            isEditable={true}
            isTestable={false}
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

    // Starts as Webhook
    expect(ui.typeSelector.get()).toHaveTextContent('Webhook');

    // Webhook URL field should be visible
    expect(ui.settings.webhook.url.get()).toBeInTheDocument();

    // Slack recipient field should not be present
    expect(ui.settings.slack.recipient.query()).not.toBeInTheDocument();

    // Switch to Slack
    await clickSelectOption(ui.typeSelector.get(), 'Slack');
    expect(ui.typeSelector.get()).toHaveTextContent('Slack');

    expect(ui.settings.slack.recipient.get()).toBeInTheDocument();
    expect(ui.settings.slack.token.get()).toBeInTheDocument();
    expect(ui.settings.slack.username.get()).toBeInTheDocument();
  });

  it('maintains form context properly during type switching', async () => {
    renderForm({
      __id: 'id-0',
      type: 'slack',
      settings: { recipient: '#alerts' },
      secureFields: {},
    });

    // Should render slack type initially
    expect(ui.typeSelector.get()).toHaveTextContent('Slack');

    // Switch to webhook
    await clickSelectOption(ui.typeSelector.get(), 'Webhook');
    await waitFor(() => {
      expect(ui.typeSelector.get()).toHaveTextContent('Webhook');
    });

    // Switch back to slack
    await clickSelectOption(ui.typeSelector.get(), 'Slack');
    await waitFor(() => {
      expect(ui.typeSelector.get()).toHaveTextContent('Slack');
    });
  });

  it('should clear settings and secure fields when switching integration types', async () => {
    const googlechatDefaults: TestChannelValues = {
      __id: 'id-0',
      type: 'googlechat',
      settings: { title: 'Alert Title', message: 'Alert Message' },
      secureFields: { url: true },
    };

    const { user } = renderForm(googlechatDefaults, googlechatDefaults);

    // Initially Google Chat
    expect(ui.typeSelector.get()).toHaveTextContent('Google Hangouts Chat');

    // Google Chat fields should be visible with secure url showing as configured
    expect(ui.settings.googlechat.url.get()).toBeDisabled();
    expect(ui.settings.googlechat.url.get()).toHaveValue('configured');

    await user.click(ui.settings.googlechat.optionalSettings.get());

    expect(ui.settings.googlechat.title.input.get()).toHaveValue('Alert Title');
    expect(ui.settings.googlechat.message.input.get()).toHaveValue('Alert Message');

    // Switch to webhook type
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
});
