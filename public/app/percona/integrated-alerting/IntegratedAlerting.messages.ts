export const Messages = {
  title: 'Percona Alerting',
  tabs: {
    alerts: 'Alerts',
    alertRules: 'Alert Rules',
    alertRuleTemplates: 'Alert Rule Templates',
  },
  alerts: {
    silenceAllAction: 'Silence all',
    unsilenceAllAction: 'Unsilence all',
    activateSuccess: 'Alert activated',
    silenceSuccess: 'Alert silenced',
    activateTitle: 'Activate',
    silenceTitle: 'Silence',
    table: {
      noData: 'No alerts',
      columns: {
        activeSince: 'Active since',
        labels: 'Labels',
        lastNotified: 'Last triggered',
        severity: 'Severity',
        state: 'State',
        actions: 'Actions',
        triggered: 'Triggered by rule',
      },
    },
  },
  alertRules: {
    table: {
      newAlertRule: 'New alert rule',
      noCreated: 'You haven`t created any alert rules yet',
      columns: {
        createdAt: 'Created',
        duration: 'Duration',
        filters: 'Filters',
        lastNotified: 'Last triggered',
        severity: 'Severity',
        summary: 'Name',
        params: 'Parameters',
        actions: 'Actions',
      },
    },
  },
  alertRuleTemplate: {
    addAction: 'Add template',
    addSuccess: 'Alert rule template successfully added',
    addModal: {
      confirm: 'Add',
      cancel: 'Cancel',
      title: 'Add alert rule template',
      upload: 'Upload',
      fields: {
        alertRuleTemplate: 'Alert rule template',
      },
    },
    table: {
      newAlertRuleTemplate: 'New alert rule template',
      noCreated: 'You haven`t created any alert rule template yet',
      columns: {
        name: 'Name',
        source: 'Source',
        createdAt: 'Created',
        actions: 'Actions',
      },
    },
  },
  alerting: 'Percona Alerting',
};
