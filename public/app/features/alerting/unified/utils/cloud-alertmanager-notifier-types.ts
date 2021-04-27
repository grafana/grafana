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
    ...rest,
  };
}

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
      option('auth_username', 'Username', 'SMTP authentication information'),
      option('auth_username', 'Username', 'SMTP authentication information'),
      option('auth_username', 'Username', 'SMTP authentication information'),
      option('require_tls', 'Require TLS', 'The SMTP TLS requirement', { element: 'checkbox' }),
      // @TODO: tls_config
      option('html', 'Email HTML body', 'The HTML body of the email notification.', {
        placeholder: '{{ template "email.default.html" . }}',
        element: 'textarea',
      }),
      option('text', 'Email text body', 'The text body of the email notification.', { element: 'textarea' }),
      // @TODO: headers
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
        'The PagerDuty integration key (when using PagerDuty integration type `Events API v2`)',
        { required: true }
      ),
      option(
        'service_key',
        'Service key',
        'The PagerDuty integration key (when using PagerDuty integration type `Prometheus`).',
        { required: true }
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
      // @todo details
      // @todo images?
      // @todo links?
      // @todo http_config
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
      // @todo http_config
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
      // @TODO actions
      option('callback_id', 'Callback ID', '', { placeholder: '{{ template "slack.default.callbackid" . }}' }),
      option('color', 'Color', '', { placeholder: '{{ if eq .Status "firing" }}danger{{ else }}good{{ end }}' }),
      option('fallback', 'Fallback', '', { placeholder: '{{ template "slack.default.fallback" . }}' }),
      // @TODO fields
      option('footer', 'Footer', '', { placeholder: '{{ template "slack.default.footer" . }}' }),
      // @TODO markdown_in array of strings
      option('pretext', 'Pre-text', '', { placeholder: '{{ template "slack.default.pretext" . }}' }),
      option('short_fields', 'Short fields', '', { element: 'checkbox' }),
      option('text', 'Message body', '', { element: 'textarea', placeholder: '{{ template "slack.default.text" . }}' }),
      option('title', 'Title', '', { placeholder: '{{ template "slack.default.title" . }}' }),
      option('title_link', 'Title link', '', { placeholder: '{{ template "slack.default.titlelink" . }}' }),
      option('image_url', 'Image URL', ''),
      option('thumb_url', 'Thumbnail URL', ''),
      // @TODO http_config
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
      // @TODO details
      // @TODO responders
      option('tags', 'Tags', 'Comma separated list of tags attached to the notifications.'),
      option('note', 'Note', 'Additional alert note.'),
      option('priority', 'Priority', 'Priority level of alert. Possible values are P1, P2, P3, P4, and P5.'),
      // @TODO http config
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
      // @TODO http config
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
      // @TODO http_config
      option(
        'max_alerts',
        'Max alerts',
        'The maximum number of alerts to include in a single webhook message. Alerts above this threshold are truncated. When leaving this at its default value of 0, all alerts are included.',
        { placeholder: '0', validationRule: '^\\d+$' }
      ),
    ],
  },
];
