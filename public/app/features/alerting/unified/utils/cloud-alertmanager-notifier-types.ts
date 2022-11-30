import { NotificationChannelOption, NotifierDTO } from 'app/types';

function option(
  propertyName: string,
  label: string,
  description: string,
  rest: Partial<NotificationChannelOption> = {}
): NotificationChannelOption {
  return {
    propertyName,
    label,
    description,
    element: 'input',
    inputType: '',
    required: false,
    secure: false,
    placeholder: '',
    validationRule: '',
    showWhen: { field: '', is: '' },
    dependsOn: '',
    ...rest,
  };
}

const basicAuthOption: NotificationChannelOption = option(
  'basic_auth',
  'Basic auth',
  'Sets the `Authorization` header with the configured username and password. Password and password_file are mutually exclusive.',
  {
    element: 'subform',
    subformOptions: [
      option('username', 'Username', ''),
      option('password', 'Password', ''),
      option('password_file', 'Password file', ''),
    ],
  }
);

const tlsConfigOption: NotificationChannelOption = option('tls_config', 'TLS config', 'Configures the TLS settings.', {
  element: 'subform',
  subformOptions: [
    option('ca_file', 'CA file', 'CA certificate to validate the server certificate with.'),
    option('cert_file', 'Cert file', 'Certificate for client cert authentication to the server.'),
    option('key_file', 'Key file', 'Key file for client cert authentication to the server.'),
    option('server_name', 'Server name', 'ServerName extension to indicate the name of the server.'),
    option('insecure_skip_verify', 'Skip verify', 'Disable validation of the server certificate.', {
      element: 'checkbox',
    }),
  ],
});

const httpConfigOption: NotificationChannelOption = option(
  'http_config',
  'HTTP Config',
  'Note that `basic_auth`, `bearer_token` and `bearer_token_file` options are mutually exclusive.',
  {
    element: 'subform',
    subformOptions: [
      option('bearer_token', 'Bearer token', 'Sets the `Authorization` header with the configured bearer token.'),
      option(
        'bearer_token_file',
        'Bearer token file',
        'Sets the `Authorization` header with the bearer token read from the configured file.'
      ),
      option('proxy_url', 'Proxy URL', 'Optional proxy URL.'),
      basicAuthOption,
      tlsConfigOption,
    ],
  }
);

export const cloudNotifierTypes: NotifierDTO[] = [
  {
    name: 'Email',
    description: 'Send notification over SMTP',
    type: 'email',
    info: '',
    heading: 'Email settings',
    options: [
      option('to', 'To', 'The email address to send notifications to.', { required: true }),
      option('from', 'From', 'The sender address.'),
      option('smarthost', 'SMTP host', 'The SMTP host through which emails are sent.'),
      option('hello', 'Hello', 'The hostname to identify to the SMTP server.'),
      option('auth_username', 'Username', 'SMTP authentication information'),
      option('auth_password', 'Password', 'SMTP authentication information'),
      option('auth_secret', 'Secret', 'SMTP authentication information'),
      option('auth_identity', 'Identity', 'SMTP authentication information'),
      option('require_tls', 'Require TLS', 'The SMTP TLS requirement', { element: 'checkbox' }),
      option('html', 'Email HTML body', 'The HTML body of the email notification.', {
        placeholder: '{{ template "email.default.html" . }}',
        element: 'textarea',
      }),
      option('text', 'Email text body', 'The text body of the email notification.', { element: 'textarea' }),
      option(
        'headers',
        'Headers',
        'Further headers email header key/value pairs. Overrides any headers previously set by the notification implementation.',
        { element: 'key_value_map' }
      ),
      tlsConfigOption,
    ],
  },
  {
    name: 'PagerDuty',
    description: 'Send notifications to PagerDuty',
    type: 'pagerduty',
    info: '',
    heading: 'PagerDuty settings',
    options: [
      option(
        'routing_key',
        'Routing key',
        'The PagerDuty integration key (when using PagerDuty integration type `Events API v2`)'
      ),
      option(
        'service_key',
        'Service key',
        'The PagerDuty integration key (when using PagerDuty integration type `Prometheus`).'
      ),
      option('url', 'URL', 'The URL to send API requests to'),
      option('client', 'Client', 'The client identification of the Alertmanager.', {
        placeholder: '{{ template "pagerduty.default.client" . }}',
      }),
      option('client_url', 'Client URL', 'A backlink to the sender of the notification.', {
        placeholder: '{{ template "pagerduty.default.clientURL" . }}',
      }),
      option('description', 'Description', 'A description of the incident.', {
        placeholder: '{{ template "pagerduty.default.description" .}}',
      }),
      option('severity', 'Severity', 'Severity of the incident.', { placeholder: 'error' }),
      option(
        'details',
        'Details',
        'A set of arbitrary key/value pairs that provide further detail about the incident.',
        {
          element: 'key_value_map',
        }
      ),
      option('images', 'Images', 'Images to attach to the incident.', {
        element: 'subform_array',
        subformOptions: [
          option('href', 'URL', '', { required: true }),
          option('source', 'Source', '', { required: true }),
          option('alt', 'Alt', '', { required: true }),
        ],
      }),
      option('links', 'Links', 'Links to attach to the incident.', {
        element: 'subform_array',
        subformOptions: [option('href', 'URL', '', { required: true }), option('text', 'Text', '', { required: true })],
      }),
      httpConfigOption,
    ],
  },
  {
    name: 'Pushover',
    description: 'Send notifications to Pushover',
    type: 'pushover',
    info: '',
    heading: 'Pushover settings',
    options: [
      option('user_key', 'User key', 'The recipient user’s user key.', { required: true }),
      option('token', 'Token', 'Your registered application’s API token, see https://pushover.net/app', {
        required: true,
      }),
      option('title', 'Title', 'Notification title.', {
        placeholder: '{{ template "pushover.default.title" . }}',
      }),
      option('message', 'Message', 'Notification message.', {
        placeholder: '{{ template "pushover.default.message" . }}',
      }),
      option('url', 'URL', 'A supplementary URL shown alongside the message.', {
        placeholder: '{{ template "pushover.default.url" . }}',
      }),
      option('priority', 'Priority', 'Priority, see https://pushover.net/api#priority', {
        placeholder: '{{ if eq .Status "firing" }}2{{ else }}0{{ end }}',
      }),
      option(
        'retry',
        'Retry',
        'How often the Pushover servers will send the same notification to the user. Must be at least 30 seconds.',
        {
          placeholder: '1m',
        }
      ),
      option(
        'expire',
        'Expire',
        'How long your notification will continue to be retried for, unless the user acknowledges the notification.',
        {
          placeholder: '1h',
        }
      ),
      httpConfigOption,
    ],
  },
  {
    name: 'Slack',
    description: 'Send notifications to Slack',
    type: 'slack',
    info: '',
    heading: 'Slack settings',
    options: [
      option('api_url', 'Webhook URL', 'The Slack webhook URL.'),
      option('channel', 'Channel', 'The #channel or @user to send notifications to.', { required: true }),
      option('icon_emoji', 'Emoji icon', ''),
      option('icon_url', 'Icon URL', ''),
      option('link_names', 'Names link', '', { element: 'checkbox' }),
      option('username', 'Username', '', { placeholder: '{{ template "slack.default.username" . }}' }),
      option('callback_id', 'Callback ID', '', { placeholder: '{{ template "slack.default.callbackid" . }}' }),
      option('color', 'Color', '', { placeholder: '{{ if eq .Status "firing" }}danger{{ else }}good{{ end }}' }),
      option('fallback', 'Fallback', '', { placeholder: '{{ template "slack.default.fallback" . }}' }),
      option('footer', 'Footer', '', { placeholder: '{{ template "slack.default.footer" . }}' }),
      option('mrkdwn_in', 'Mrkdwn fields', 'An array of field names that should be formatted by mrkdwn syntax.', {
        element: 'string_array',
      }),
      option('pretext', 'Pre-text', '', { placeholder: '{{ template "slack.default.pretext" . }}' }),
      option('short_fields', 'Short fields', '', { element: 'checkbox' }),
      option('text', 'Message body', '', { element: 'textarea', placeholder: '{{ template "slack.default.text" . }}' }),
      option('title', 'Title', '', { placeholder: '{{ template "slack.default.title" . }}' }),
      option('title_link', 'Title link', '', { placeholder: '{{ template "slack.default.titlelink" . }}' }),
      option('image_url', 'Image URL', ''),
      option('thumb_url', 'Thumbnail URL', ''),
      option('actions', 'Actions', '', {
        element: 'subform_array',
        subformOptions: [
          option('text', 'Text', '', { required: true }),
          option('type', 'Type', '', { required: true }),
          option('url', 'URL', 'Either url or name and value are mandatory.'),
          option('name', 'Name', ''),
          option('value', 'Value', ''),
          option('confirm', 'Confirm', '', {
            element: 'subform',
            subformOptions: [
              option('text', 'Text', '', { required: true }),
              option('dismiss_text', 'Dismiss text', ''),
              option('ok_text', 'OK text', ''),
              option('title', 'Title', ''),
            ],
          }),
          option('style', 'Style', ''),
        ],
      }),
      option('fields', 'Fields', '', {
        element: 'subform_array',
        subformOptions: [
          option('title', 'Title', '', { required: true }),
          option('value', 'Value', '', { required: true }),
          option('short', 'Short', '', { element: 'checkbox' }),
        ],
      }),
      httpConfigOption,
    ],
  },
  {
    name: 'OpsGenie',
    description: 'Send notifications to OpsGenie',
    type: 'opsgenie',
    info: '',
    heading: 'OpsGenie settings',
    options: [
      option('api_key', 'API key', 'The API key to use when talking to the OpsGenie API.'),
      option('api_url', 'API URL', 'The host to send OpsGenie API requests to.'),
      option('message', 'Message', 'Alert text limited to 130 characters.'),
      option('description', 'Description', 'A description of the incident.', {
        placeholder: '{{ template "opsgenie.default.description" . }}',
      }),
      option('source', 'Source', 'A backlink to the sender of the notification.', {
        placeholder: '{{ template "opsgenie.default.source" . }}',
      }),
      option(
        'details',
        'Details',
        'A set of arbitrary key/value pairs that provide further detail about the incident.',
        {
          element: 'key_value_map',
        }
      ),
      option('tags', 'Tags', 'Comma separated list of tags attached to the notifications.'),
      option('note', 'Note', 'Additional alert note.'),
      option('priority', 'Priority', 'Priority level of alert. Possible values are P1, P2, P3, P4, and P5.'),
      option('responders', 'Responders', 'List of responders responsible for notifications.', {
        element: 'subform_array',
        subformOptions: [
          option('type', 'Type', '"team", "user", "escalation" or schedule".', { required: true }),
          option('id', 'ID', 'Exactly one of these fields should be defined.'),
          option('name', 'Name', 'Exactly one of these fields should be defined.'),
          option('username', 'Username', 'Exactly one of these fields should be defined.'),
        ],
      }),
      httpConfigOption,
    ],
  },
  {
    name: 'VictorOps',
    description: 'Send notifications to VictorOps',
    type: 'victorops',
    info: '',
    heading: 'VictorOps settings',
    options: [
      option('api_key', 'API key', 'The API key to use when talking to the VictorOps API.'),
      option('api_url', 'API URL', 'The VictorOps API URL.'),
      option('routing_key', 'Routing key', 'A key used to map the alert to a team.', { required: true }),
      option('message_type', 'Message type', 'Describes the behavior of the alert (CRITICAL, WARNING, INFO).'),
      option('entity_display_name', 'Entity display name', 'Contains summary of the alerted problem.', {
        placeholder: '{{ template "victorops.default.entity_display_name" . }}',
      }),
      option('state_message', 'State message', 'Contains long explanation of the alerted problem.', {
        placeholder: '{{ template "victorops.default.state_message" . }}',
      }),
      option('monitoring_tool', 'Monitoring tool', 'The monitoring tool the state message is from.', {
        placeholder: '{{ template "victorops.default.monitoring_tool" . }}',
      }),
      httpConfigOption,
    ],
  },
  {
    name: 'Webhook',
    description: 'Send notifications to a webhook',
    type: 'webhook',
    info: '',
    heading: 'Webhook settings',
    options: [
      option('url', 'URL', 'The endpoint to send HTTP POST requests to.', { required: true }),
      option(
        'max_alerts',
        'Max alerts',
        'The maximum number of alerts to include in a single webhook message. Alerts above this threshold are truncated. When leaving this at its default value of 0, all alerts are included.',
        { placeholder: '0', validationRule: '(^\\d+$|^$)' }
      ),
      httpConfigOption,
    ],
  },
  {
    name: 'Discord',
    description: 'Sends notifications to Discord',
    type: 'discord',
    info: '',
    heading: 'Discord settings',
    options: [
      option('title', 'Title', 'Templated title of the message', {
        placeholder: '{{ template "discord.default.title" . }}',
      }),
      option(
        'message',
        'Message Content',
        'Mention a group using @ or a user using <@ID> when notifying in a channel',
        { placeholder: '{{ template "discord.default.message" . }}' }
      ),
      option('webhook_url', 'Webhook URL', '', { placeholder: 'Discord webhook URL', required: true }),
      httpConfigOption,
    ],
  },
];

export const globalConfigOptions: NotificationChannelOption[] = [
  // email
  option('smtp_from', 'SMTP from', 'The default SMTP From header field.'),
  option(
    'smtp_smarthost',
    'SMTP smarthost',
    'The default SMTP smarthost used for sending emails, including port number. Port number usually is 25, or 587 for SMTP over TLS (sometimes referred to as STARTTLS). Example: smtp.example.org:587'
  ),
  option('smtp_hello', 'SMTP hello', 'The default hostname to identify to the SMTP server.', {
    placeholder: 'localhost',
  }),
  option(
    'smtp_auth_username',
    'SMTP auth username',
    "SMTP Auth using CRAM-MD5, LOGIN and PLAIN. If empty, Alertmanager doesn't authenticate to the SMTP server."
  ),
  option('smtp_auth_password', 'SMTP auth password', 'SMTP Auth using LOGIN and PLAIN.'),
  option('smtp_auth_identity', 'SMTP auth identity', 'SMTP Auth using PLAIN.'),
  option('smtp_auth_secret', 'SMTP auth secret', 'SMTP Auth using CRAM-MD5.'),
  option(
    'smtp_require_tls',
    'SMTP require TLS',
    'The default SMTP TLS requirement. Note that Go does not support unencrypted connections to remote SMTP endpoints.',
    {
      element: 'checkbox',
    }
  ),

  // slack
  option('slack_api_url', 'Slack API URL', ''),
  option('victorops_api_key', 'VictorOps API key', ''),
  option('victorops_api_url', 'VictorOps API URL', '', {
    placeholder: 'https://alert.victorops.com/integrations/generic/20131114/alert/',
  }),
  option('pagerduty_url', 'PagerDuty URL', 'https://events.pagerduty.com/v2/enqueue'),
  option('opsgenie_api_key', 'OpsGenie API key', ''),
  option('opsgenie_api_url', 'OpsGenie API URL', '', { placeholder: 'https://api.opsgenie.com/' }),
  option('wechat_api_url', 'WeChat API URL', '', { placeholder: 'https://qyapi.weixin.qq.com/cgi-bin/' }),
  option('wechat_api_secret', 'WeChat API secret', ''),
  option('wechat_api_corp_id', 'WeChat API corp id', ''),
  httpConfigOption,
  option(
    'resolve_timeout',
    'Resolve timeout',
    'ResolveTimeout is the default value used by alertmanager if the alert does not include EndsAt, after this time passes it can declare the alert as resolved if it has not been updated. This has no impact on alerts from Prometheus, as they always include EndsAt.',
    {
      placeholder: '5m',
    }
  ),
];
