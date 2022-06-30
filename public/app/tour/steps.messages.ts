export const Messages = {
  dashboards: {
    pmmShipping:
      'PMM ships with several Grafana dashboards for efficient database monitoring, from CPU utilization to MySQL Replication Summary.',
    checkOur: 'Check our ',
    dashboardsRepo: 'dashboards repo',
    contribute: ' and see how you can contribute with your own.',
  },
  alerting: {
    simplerToUse: "PMM comes with a simpler-to-use alerting system that works side-by-side with Grafana's.",
    youDefine:
      'You define what system metrics are critical to your environment, and what thresholds are acceptable for each metric. When something needs your attention, PMM automatically sends you an alert through your specified communication channels.',
    howToUse: 'To use PMM Alerting, make sure to activate it via Settings, on this sidebar.',
    moreInfo: 'For more information, see the ',
    docs: 'Integrated Alerting documentation',
  },
  configPanel: {
    services:
      "Here you can check Services, Agents and Nodes in your PMM's Inventory, and add new instances for monitoring: PostgreSQL, MySQL, MongoDB, HAProxy, etc.",
    settings:
      'PMM Settings also live here. From there, you can connect your PMM instance to Percona Platform and change more advanced settings, for example to activate PMM Alerting, DBaaS, etc.',
    settingsDocs: 'Documentation for PMM Settings',
    settingsDocsLink: 'here',
  },
  advisors: {
    pmmIncludes:
      'PMM includes a set of Advisors that run checks against the databases connected to PMM. The checks identify and alert you of potential security threats, performance degradation, data loss, data corruption, non-compliance issues, etc.',
    findOutMore: 'To find out more, check out the ',
    docs: 'Advisors documentation',
  },
};
