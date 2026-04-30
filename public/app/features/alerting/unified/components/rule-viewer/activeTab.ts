/** Rule viewer `tab=` query values; separated from RuleViewer.tsx to avoid circular imports with hooks. */
export enum ActiveTab {
  Query = 'query',
  Instances = 'instances',
  History = 'history',
  Notifications = 'notifications',
  Routing = 'routing',
  VersionHistory = 'version-history',
  Enrichment = 'enrichment',
}
