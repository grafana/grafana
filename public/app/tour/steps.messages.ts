export const Messages = {
  dashboards: {
    title: 'Dashboards',
    browse: 'Here you can access your Home Dashboard and browse the dashboards.',
    folders: 'Dashboards are grouped into folders. You can customize these by renaming them or creating new ones.',
    playlists:
      'You can also create and browse playlists. A playlist can be a great way to to just show your metrics to your team or visitors.',
  },
  pmmDashboards: {
    title: 'PMM Dashboards',
    grafanaTechnology:
      'PMM dashboards are built on Grafana technology, powered by decades of Percona expertise in database performance optimization.',
    observe:
      'Use these dashboards to observe top to bottom metrics of performance and get to the root of the database issues in the matter of minutes.',
    zoomIn:
      'Zoom-in, drill-down database performance from node to single query levels. Get insights about your DBs no matter where they are stored - on-premises, in the cloud, or hybrid environments.',
  },
  qan: {
    title: 'PMM Query Analytics',
    queries: 'Query Analytics (QAN) dashboard shows how queries are executed along with the query count and time.',
    analyze:
      'It helps you analyze the database queries over time, optimize database performance, and find and remedy the source of problems.',
  },
  explore: {
    title: 'Explore',
    data: 'If you just want to explore your data and do not want to create a dashboard, then Explore is the option for you.',
    graphs: 'If your data source supports graph and table data, then Explore shows the results as a graph and a table.',
    query: 'Explore panel strips away the dashboard and panel options so that you can focus on the query.',
  },
  alerting: {
    title: 'PMM Alerting',
    simplerToUse: "PMM comes with a simpler-to-use alerting system that works side-by-side with Grafana's.",
    youDefine:
      'You define what system metrics are critical to your environment, and what thresholds are acceptable for each metric. When something needs your attention, PMM automatically sends you an alert through your specified communication channels.',
    howToUse: 'To use PMM Alerting, make sure to activate it via Settings, on this sidebar.',
    moreInfo: 'For more information, see the ',
    docs: 'Integrated Alerting documentation',
  },
  configPanel: {
    title: 'Configuration Panel',
    services:
      "Here you can check Services, Agents and Nodes in your PMM's Inventory, and add new instances for monitoring: PostgreSQL, MySQL, MongoDB, HAProxy, etc.",
    settings:
      'PMM Settings also live here. From there, you can connect your PMM instance to Percona Platform and change more advanced settings, for example to activate PMM Alerting, private DBaaS feature (currently in technical preview), etc.',
    settingsDocs: 'Documentation for PMM Settings',
    settingsDocsLink: 'here',
  },
  serverAdmin: {
    title: 'Server Admin',
    userManagement: 'In the Server Admin panel you can assign and control user management for PMM:',
    addEditRemove: 'Add, edit, and remove users.',
    grant: 'Grant or Revoke admin privileges for a user.',
    manageOrg: 'Manage organizations to which the user belongs and their assigned role.',
    changeOrg: 'Change the organization role assigned to the user account.',
  },
  advisors: {
    title: 'Advisor checks',
    pmmIncludes:
      'PMM includes a set of Advisors that run checks against the databases connected to PMM. The checks identify and alert you of potential security threats, performance degradation, data loss, data corruption, non-compliance issues, etc.',
    findOutMore: 'To find out more, check out the ',
    docs: 'Advisors documentation',
  },
  dbaas: {
    title: 'DBaaS',
    feature:
      'Private DBaaS feature allows you to CRUD (Create, Read, Update, Delete) Percona XtraDB Cluster (PXC), and Percona Server for MongoDB (PSMDB) managed databases in Kubernetes clusters.',
    techPreview:
      'This is a technical preview feature recommended for test environments only. To use private DBaaS feature, make sure to activate it via Settings, on the sidebar.',
    benefits: 'The benefits of using private DBaaS feature are manifold such as:',
    singleInterface:
      'A single interface to deploy and manage your open source databases on-premises, in the cloud, or across hybrid and multi-cloud environments.',
    dbManagement: 'Critical database management operations, such as backup, recovery, and patching.',
    automation:
      'Enhanced automation and advisory services allow you to find, eliminate, and prevent outages, security issues, and slowdowns.',
  },
};
