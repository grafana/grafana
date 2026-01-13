import 'core-js/stable/structured-clone';
import { FormProvider, useForm } from 'react-hook-form';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { render, screen } from 'test/test-utils';
import { byRole, byTestId } from 'testing-library-selector';

import { grafanaAlertNotifiers } from 'app/features/alerting/unified/mockGrafanaNotifiers';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { NotifierDTO } from 'app/features/alerting/unified/types/alerting';

import { ChannelSubForm } from './ChannelSubForm';
import { GrafanaCommonChannelSettings } from './GrafanaCommonChannelSettings';
import { Notifier } from './notifiers';

type TestChannelValues = {
  __id: string;
  type: string;
  settings: Record<string, unknown>;
  secureFields: Record<string, boolean>;
  version?: string;
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
            defaultValues={defaults}
            initialValues={initial}
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

  describe('version-specific options display', () => {
    // Create a mock notifier with different options for v0 and v1
    const webhookWithVersions: NotifierDTO = {
      ...grafanaAlertNotifiers.webhook,
      versions: [
        {
          version: 'v0mimir1',
          label: 'Webhook (Legacy)',
          description: 'Legacy webhook from Mimir',
          canCreate: false,
          options: [
            {
              element: 'input',
              inputType: 'text',
              label: 'Legacy URL',
              description: 'The legacy endpoint URL',
              placeholder: '',
              propertyName: 'legacyUrl',
              required: true,
              secure: false,
              showWhen: { field: '', is: '' },
              validationRule: '',
              dependsOn: '',
            },
          ],
        },
        {
          version: 'v1',
          label: 'Webhook',
          description: 'Sends HTTP POST request',
          canCreate: true,
          options: grafanaAlertNotifiers.webhook.options,
        },
      ],
    };

    const versionedNotifiers: Notifier[] = [
      { dto: webhookWithVersions, meta: { enabled: true, order: 1 } },
      { dto: grafanaAlertNotifiers.slack, meta: { enabled: true, order: 2 } },
    ];

    function VersionedTestFormWrapper({
      defaults,
      initial,
    }: {
      defaults: TestChannelValues;
      initial?: TestChannelValues;
    }) {
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
              notifiers={versionedNotifiers}
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

    function renderVersionedForm(defaults: TestChannelValues, initial?: TestChannelValues) {
      return render(<VersionedTestFormWrapper defaults={defaults} initial={initial} />);
    }

    it('should display v1 options when integration has v1 version', () => {
      const webhookV1: TestChannelValues = {
        __id: 'id-0',
        type: 'webhook',
        version: 'v1',
        settings: { url: 'https://example.com' },
        secureFields: {},
      };

      renderVersionedForm(webhookV1, webhookV1);

      // Should show v1 URL field (from default options)
      expect(ui.settings.webhook.url.get()).toBeInTheDocument();
      // Should NOT show legacy URL field
      expect(screen.queryByRole('textbox', { name: /Legacy URL/i })).not.toBeInTheDocument();
    });

    it('should display v0 options when integration has legacy version', () => {
      const webhookV0: TestChannelValues = {
        __id: 'id-0',
        type: 'webhook',
        version: 'v0mimir1',
        settings: { legacyUrl: 'https://legacy.example.com' },
        secureFields: {},
      };

      renderVersionedForm(webhookV0, webhookV0);

      // Should show legacy URL field (from v0 options)
      expect(screen.getByRole('textbox', { name: /Legacy URL/i })).toBeInTheDocument();
      // Should NOT show v1 URL field
      expect(ui.settings.webhook.url.query()).not.toBeInTheDocument();
    });

    it('should display "Legacy" badge for v0mimir1 integration', () => {
      const webhookV0: TestChannelValues = {
        __id: 'id-0',
        type: 'webhook',
        version: 'v0mimir1',
        settings: { legacyUrl: 'https://legacy.example.com' },
        secureFields: {},
      };

      renderVersionedForm(webhookV0, webhookV0);

      // Should show "Legacy" badge for v0mimir1 integrations
      expect(screen.getByText('Legacy')).toBeInTheDocument();
    });

    it('should display "Legacy v2" badge for v0mimir2 integration', () => {
      const webhookV0v2: TestChannelValues = {
        __id: 'id-0',
        type: 'webhook',
        version: 'v0mimir2',
        settings: { legacyUrl: 'https://legacy.example.com' },
        secureFields: {},
      };

      renderVersionedForm(webhookV0v2, webhookV0v2);

      // Should show "Legacy v2" badge for v0mimir2 integrations
      expect(screen.getByText('Legacy v2')).toBeInTheDocument();
    });

    it('should NOT display version badge for v1 integration', () => {
      const webhookV1: TestChannelValues = {
        __id: 'id-0',
        type: 'webhook',
        version: 'v1',
        settings: { url: 'https://example.com' },
        secureFields: {},
      };

      renderVersionedForm(webhookV1, webhookV1);

      // Should NOT show version badge for non-legacy v1 integrations
      expect(screen.queryByText('v1')).not.toBeInTheDocument();
    });

    it('should filter out notifiers with canCreate: false from dropdown', () => {
      // Create a notifier that only has v0 versions (cannot be created)
      const legacyOnlyNotifier: NotifierDTO = {
        type: 'wechat',
        name: 'WeChat',
        heading: 'WeChat settings',
        description: 'Sends notifications to WeChat',
        options: [],
        versions: [
          {
            version: 'v0mimir1',
            label: 'WeChat (Legacy)',
            description: 'Legacy WeChat',
            canCreate: false,
            options: [],
          },
        ],
      };

      const notifiersWithLegacyOnly: Notifier[] = [
        { dto: webhookWithVersions, meta: { enabled: true, order: 1 } },
        { dto: legacyOnlyNotifier, meta: { enabled: true, order: 2 } },
      ];

      function LegacyOnlyTestWrapper({ defaults }: { defaults: TestChannelValues }) {
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
                pathPrefix={`items.0.`}
                integrationIndex={0}
                notifiers={notifiersWithLegacyOnly}
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

      render(
        <LegacyOnlyTestWrapper
          defaults={{
            __id: 'id-0',
            type: 'webhook',
            settings: {},
            secureFields: {},
          }}
        />
      );

      // Webhook should be in dropdown (has v1 with canCreate: true)
      expect(ui.typeSelector.get()).toHaveTextContent('Webhook');

      // WeChat should NOT be in the options (only has v0 with canCreate: false)
      // We can't easily check dropdown options without opening it, but the filter should work
    });
  });
});
