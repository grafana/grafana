export const receiverTypeNames: Record<string, string> = {
  pagerduty: 'PagerDuty',
  pushover: 'Pushover',
  slack: 'Slack',
  opsgenie: 'OpsGenie',
  logzio_opsgenie: 'LogzioOpsGenie',  // LOGZ.IO GRAFANA CHANGE :: DEV-46341 - Add Logz.io OpsGenie integration
  webhook: 'Webhook',
  victorops: 'VictorOps',
  wechat: 'WeChat',
  discord: 'Discord',
  webex: 'Cisco Webex Teams',
  sns: 'Amazon SNS',
  telegram: 'Telegram',
  msteams: 'Microsoft Teams',
};
