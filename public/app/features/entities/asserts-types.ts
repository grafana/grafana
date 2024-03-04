import { EdgeConfig, GraphData, NodeConfig } from '@antv/g6';

import { DataQuery } from '@grafana/schema';

export type Unwrap<T> =
  T extends Promise<infer U>
    ? U
    : T extends (...args: any) => Promise<infer U>
      ? U
      : T extends (...args: any) => infer U
        ? U
        : T;

export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export interface Sort<T = string> {
  order: 'asc' | 'desc';
  field: T;
}
export interface SummaryMetric {
  id: string;
  assertionName: string;
  alertName: string;
  category: string;
  hovered?: boolean;
  healthStates: HealthState[];
  labels: Array<Record<string, string>>;
  nestedSummaries: SummaryMetric[];
}

export interface Definition {
  bindings: {
    service_type?: string;
  } & Record<string, string | undefined>;
  entityName?: string;
  boundDescription: string;
  definitionId: number;
  description?: string;
  id: number;
  // score: number;
  filterCriteria?: EntityFilterCriteria[];
  // entityKeys?: AssertionsBoardEntity[];
}

export interface TopDefinition extends Pick<Definition, 'boundDescription'> {
  rank?: number;
}

export interface ChartPoint {
  time: number;
  value?: number | null;
  values?: number[] | null[];
}

export interface Threshold {
  type: 'minmax' | 'single';
  name: string;
  labels: Record<string, string>;
  values: ChartPoint[];
}

export interface Metric {
  name: string;
  values: ChartPoint[];
  query?: string;
  color?: string;
  fillZeros?: boolean;
  metric?: Record<string, string>;
}

export interface Edge {
  destination: number;
  id: number;
  properties: { _created: number; _updated: number; cardinality: string };
  cardinality: string;
  _created: number;
  _updated: number;
  source: number;
  type: string;
  trafficPresent: boolean;
  callsPerMinute: number | undefined;
}

export type EntityProperties = Partial<Record<string, string | number>> & {
  _created?: number;
  _updated?: number;
};

export type AssertionSeverity = 'warning' | 'critical' | 'info';

export interface EntityAssertion {
  severity?: AssertionSeverity;
  amend?: boolean;
  assertions?: Array<{
    assertionName: string;
    severity: AssertionSeverity;
    category: string;
    entityType: string;
  }>;
}

export interface HealthState extends EntityAssertion {
  start: number;
  end: number;
  context: Record<string, string>;
}

export interface Cluster {
  start: number;
  end: number;
  assertionStates: HealthState[];
  assertionSummaries: Array<{
    summary: string;
    category: string;
  }>;
}

export interface Entity {
  id: number;
  name: string;
  type: string;
  assertion: EntityAssertion | undefined;
  connectedAssertion: EntityAssertion | undefined;
  properties: EntityProperties;
  connectedEntityTypes?: Record<string, number>;
  scope: Scope | undefined;

  // the fields below is assigned by client
  activeConnectedEntityType?: string;
  parentEntityId?: number;
  nameWithNamespace?: string;
  // used for sorting, assigned by client in entities.slice;
  assertionScore?: number;
  edgeWithActiveElement?: Edge;
}

export type Order = 'asc' | 'desc';

export enum AssertionEntityTypes {
  SERVICE = 'Service',
  NAMESPACE = 'Namespace',
  NODE = 'Node',
  ASSERTION = 'Assertion',
  TOPIC = 'Topic',
  POD = 'Pod',
}

export interface Scope {
  env?: string;
  site?: string;
  namespace?: string;
}

export interface NodeStyle {
  size: number;
  fill: string;
  fontSize: number;
  fontColor: string;
  strokeFirstLevelColor: string;
  strokeSecondLevelColor: string;
  strokeSecondLevelWidth: number;
  strokeFirstLevelWidth: number;
  activeBgStroke?: string;
}

export interface GraphCustomNode extends NodeConfig {
  entityType: string;
  showLabels?: boolean;
  expandedFrom?: string;
  properties: EntityProperties;
  style?: Partial<NodeStyle> & {
    iconColor?: string;
    opacity?: number;
    cursor?: string;
    stroke?: string;
    lineWidth?: number;
  };
  disabled?: boolean;
  hidden?: boolean;
  assertion: EntityAssertion | undefined;
  connectedAssertion: EntityAssertion | undefined;
  label: string;
  connectedEntityTypes?: Record<string, number>;
  activeConnectedEntityType?: string;
  parentEntityId?: number;
  fullLabel?: string;
  scope: Scope | undefined;
  valueLabel?: string;
  disableTooltip?: boolean;
  summaryMetrics?: SummaryMetric[];
}

export interface GraphCustomEdge extends EdgeConfig {
  expandedFrom?: string;
  showLabels?: boolean;
  disabled?: boolean;
  trafficPresent: boolean;
  callsPerMinute: number | undefined;
}

export interface GraphCustomData extends GraphData {
  nodes: GraphCustomNode[];
  edges: GraphCustomEdge[];
}

export interface UserPermission {
  name: Permission;
  description: string;
}

export interface UserRole {
  name: string;
  description: string;
  visibility: string;
  permissions: UserPermission[];
}

export interface UserProfile {
  userId: string;
  email: string;
  profilePic?: string;
  locale: string;
  hostedDomain: string;
}

export enum Permission {
  USER = 'USER',
  RULE_THRESHOLD = 'RULE_THRESHOLD',
  MANAGE_ALERTS = 'MANAGE_ALERTS',
  CONFIG_PROM_RULES = 'CONFIG_PROM_RULES',
  CUSTOM_DASHBOARD = 'CUSTOM_DASHBOARD',
  MANAGE_SLO = 'MANAGE_SLO',
  MANAGE_INTEGRATIONS = 'MANAGE_INTEGRATIONS',
  LIST_USERS = 'LIST_USERS',
  MANAGE_USER_ROLES = 'MANAGE_USER_ROLES',
  INVITE_USERS = 'INVITE_USERS',
  ACCESS_KEY_ALLOWED = 'ACCESS_KEY_ALLOWED',
  CONFIG_AWS_CLOUDWATCH = 'CONFIG_AWS_CLOUDWATCH',
  CONFIG_AWS_EXPORTER = 'CONFIG_AWS_EXPORTER',
  CONFIG_RELABEL_RULES = 'CONFIG_RELABEL_RULES',
  CONFIG_AUTH = 'CONFIG_AUTH',
  MANAGE_LICENSE_INFO = 'MANAGE_LICENSE_INFO',
  CONFIG_PROMETHEUS = 'CONFIG_PROMETHEUS',
  CONFIG_MODEL_RULES = 'CONFIG_MODEL_RULES',
  CONFIG_TENANT_CREDENTIAL = 'CONFIG_TENANT_CREDENTIAL',
  READ_TRACE_CONFIG = 'READ_TRACE_CONFIG',
  WRITE_TRACE_CONFIG = 'WRITE_TRACE_CONFIG',
  IMPORT_CONFIG = 'IMPORT_CONFIG',
  EXPORT_CONFIG = 'EXPORT_CONFIG',
  DELETE_USER = 'DELETE_USER',
  GRAFANA_ADMIN = 'GRAFANA_ADMIN',
  CONFIG_OTEL_COLLECTOR = 'CONFIG_OTEL_COLLECTOR',
  WRITE_OTEL_COLLECTOR = 'WRITE_OTEL_COLLECTOR',
  WRITE_AWS_CLOUDWATCH = 'WRITE_AWS_CLOUDWATCH',
  WRITE_PROM_RULES = 'WRITE_PROM_RULES',
  CONFIG_ALERTMANAGER = 'CONFIG_ALERTMANAGER',
  WRITE_ALERTMANAGER = 'WRITE_ALERTMANAGER',
  DISABLE_PROM_RULES = 'DISABLE_PROM_RULES',
}

export interface EntityFilterCriteria {
  entityType: string;
  propertyMatchers: EntityFilterPropertyMatcher[];
  havingAssertion?: boolean;
  connectToEntityTypes?: string[];
}

export interface EntityFilterPropertyMatcher {
  id: number;
  name: string;
  value: string | number;
  op: StringRules | NumberRules;
  type: EntityPropertyTypes;
  uom?: string | null;
}

export enum StringRules {
  EQUALS = '=',
  NOT_EQUALS = '<>',
  STARTS_WITH = 'STARTS WITH',
  CONTAINS = 'CONTAINS',
  IS_NULL = 'IS NULL',
  IS_NOT_NULL = 'IS NOT NULL',
}

export enum NumberRules {
  EQUALS = '=',
  NOT_EQUALS = '<>',
  GREATER = '>',
  GREATER_OR_EQUAL = '>=',
  LESS = '<',
  LESS_OR_EQUAL = '<=',
  IS_NULL = 'IS NULL',
  IS_NOT_NULL = 'IS NOT NULL',
}

export enum EntityPropertyTypes {
  STRING = 'String',
  DOUBLE = 'Double',
}

export interface Incident {
  burnRate: number;
  endTime: number;
  startTime: number;
  summary: string;
  severity: AssertionSeverity;
}

export enum Comparator {
  GreaterThan = 'GT',
  GreaterThanOrEqualTo = 'GE',
  EqualTo = 'EQ',
  NotEqualTo = 'NE',
  LessThanOrEqualTo = 'LE',
  LessThan = 'LT',
}

export interface SelectOption {
  value: string | number;
  label: string | JSX.Element;
}

export interface PromQuery extends DataQuery {
  expr?: string;
  instant?: boolean;
  range?: string;
}

export interface TempoQuery extends DataQuery {
  search?: string;
  query?: string;
  limit?: number;
  tableType: 'traces' | 'spans';
}

export interface LokiQuery extends DataQuery {
  expr?: string;
}

export interface GrafanaPlugin {
  id: number;
  status: string;
  slug: string;
}
