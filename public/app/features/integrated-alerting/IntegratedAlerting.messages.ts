export const Messages = {
  tabs: {
    alerts: 'Alerts',
    alertRules: 'Alert Rules',
    alertRuleTemplates: 'Alert Rule Templates',
    notificationChannels: 'Notification Channels',
  },
  alerts: {
    table: {
      noData: 'No alerts',
      columns: {
        activeSince: 'Active Since',
        labels: 'Labels',
        lastNotified: 'Last Notified',
        severity: 'Severity',
        summary: 'Name',
        state: 'State',
        actions: 'Actions',
      },
    },
  },
  alertRules: {
    table: {
      noData: 'No alert rules found',
      columns: {
        createdAt: 'Created',
        duration: 'Duration',
        filters: 'Filters',
        lastNotified: 'Last Notified',
        severity: 'Severity',
        summary: 'Name',
        threshold: 'Threshold',
        actions: 'Actions',
      },
    },
  },
  alertRuleTemplate: {
    addAction: 'Add',
    addSuccess: 'Alert rule template successfully added',
    addModal: {
      confirm: 'Add',
      cancel: 'Cancel',
      title: 'Add Alert Rule Template',
      upload: 'Upload',
      fields: {
        alertRuleTemplate: 'Alert Rule Template',
      },
    },
    table: {
      noData: 'No templates found',
      columns: {
        name: 'Name',
        source: 'Source',
        createdAt: 'Created',
        actions: 'Actions',
      },
    },
  },
};
