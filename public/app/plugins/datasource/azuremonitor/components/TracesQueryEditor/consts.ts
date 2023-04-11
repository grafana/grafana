import { omit } from 'lodash';

export const Tables = {
  availabilityResults: 'Availablity Results',
  dependencies: 'Dependencies',
  events: 'Events',
  exceptions: 'Exceptions',
  pageViews: 'Page Views',
  requests: 'Requests',
  traces: 'Traces',
};

// Resource centric tables mapped to legacy tables
export const tables = {
  AppAvailabilityResults: 'availabilityResults',
  AppDependencies: 'dependencies',
  AppEvents: 'events',
  AppExceptions: 'exceptions',
  AppPageViews: 'pageViews',
  AppRequests: 'requests',
  AppTraces: 'traces',
};

// Properties to omit when generating the attributes bag
export const attributesOmit = [
  'operationId',
  'duration',
  'id',
  'name',
  'problemId',
  'operation_ParentId',
  'timestamp',
  'customDimensions',
  'operation_Name',
];

// Common resource centric properties mapped to legacy property names
export const common = {
  appId: 'ResourceGUID',
  application_Version: 'AppVersion',
  appName: '_ResourceId',
  client_Browser: 'ClientBrowser',
  client_City: 'ClientCity',
  client_CountryOrRegion: 'ClientCountryOrRegion',
  client_IP: 'ClientIP',
  client_Model: 'ClientModel',
  client_OS: 'ClientOS',
  client_StateOrProvince: 'ClientStateOrProvince',
  client_Type: 'ClientType',
  cloud_RoleInstance: 'AppRoleInstance',
  cloud_RoleName: 'AppRoleName',
  customDimensions: 'Properties',
  customMeasurements: 'Measurements',
  duration: 'DurationMs',
  id: 'Id',
  iKey: 'IKey',
  itemCount: 'ItemCount',
  itemId: '_ItemId',
  itemType: 'Type',
  name: 'Name',
  operation_Id: 'OperationId',
  operation_Name: 'OperationName',
  operation_ParentId: 'OperationParentId',
  operation_SyntheticSource: 'OperationSyntheticSource',
  performanceBucket: 'PerformanceBucket',
  sdkVersion: 'SDKVersion',
  session_Id: 'SessionId',
  success: 'Success',
  timestamp: 'TimeGenerated',
  user_AccountId: 'UserAccountId',
  user_AuthenticatedId: 'UserAuthenticatedId',
  user_Id: 'UserId',
};

// Additional properties for availabilityResults
export const availabilityResultsSchema = {
  ...common,
  location: 'Location',
  message: 'Message',
  size: 'Size',
};

// Additional properties for dependencies
export const dependenciesSchema = {
  ...common,
  data: 'Data',
  resultCode: 'ResultCode',
  target: 'Target',
  type: 'DependencyType',
};

// Additional properties for events
export const eventsSchema = omit(common, ['duration', 'id', 'success', 'performanceBucket']);

// Additional properties for pageVies
export const pageViewsSchema = omit(
  {
    ...common,
    url: 'Url',
  },
  ['success']
);

// Additional properties for requests
export const requestsSchema = {
  resultCode: 'ResultCode',
  source: 'Source',
  url: 'Url',
};

// Additional properties for exceptions
export const exceptionsSchema = omit(
  {
    ...common,
    assembly: 'Assembly',
    details: 'Details',
    handledAt: 'HandledAt',
    innermostAssembly: 'InnermostAssembly',
    innermostMessage: 'InnermostMessage',
    innermostMethod: 'InnermostMethod',
    innermostType: 'InnermostType',
    message: 'Message',
    method: 'Method',
    outerAssembly: 'OuterAssembly',
    outerMessage: 'OuterMessage',
    outerMethod: 'OuterMethod',
    outerType: 'OuterType',
    problemId: 'ProblemId',
    severityLevel: 'SeverityLevel',
    type: 'ExceptionType',
  },
  ['duration', 'id', 'name', 'performanceBucket', 'success']
);

// Additional properties for traces
export const tracesSchema = omit(
  {
    message: 'Message',
    severityLevel: 'SeverityLevel',
  },
  ['duration', 'id', 'name', 'performanceBucket', 'success']
);

export const tablesSchema = {
  availabilityResults: availabilityResultsSchema,
  dependencies: dependenciesSchema,
  customEvents: eventsSchema,
  exceptions: exceptionsSchema,
  pageViews: pageViewsSchema,
  requests: requestsSchema,
  traces: tracesSchema,
};

export const tableTags = Object.entries(tablesSchema).reduce(
  (val, [k, v]) => ({ ...val, [k]: Object.keys(omit(v, attributesOmit)).join(',') }),
  {}
);
