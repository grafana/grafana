import { baseAPI as api } from './baseAPI';
export const addTagTypes = ['Dashboard'] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getDashboard: build.query<GetDashboardResponse, GetDashboardArg>({
        query: (queryArg) => ({
          url: `/dashboards/${queryArg.name}`,
          params: {
            pretty: queryArg.pretty,
          },
        }),
        providesTags: ['Dashboard'],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as generatedAPI };
export type GetDashboardResponse = /** status 200 OK */ Dashboard;
export type GetDashboardArg = {
  /** name of the Dashboard */
  name: string;
  /** If 'true', then the output is pretty printed. Defaults to 'false' unless the user-agent indicates a browser or command-line HTTP tool (curl and wget). */
  pretty?: string;
};
export type Time = string;
export type FieldsV1 = object;
export type ManagedFieldsEntry = {
  /** APIVersion defines the version of this resource that this field set applies to. The format is "group/version" just like the top-level APIVersion field. It is necessary to track the version of a field set because it cannot be automatically converted. */
  apiVersion?: string;
  /** FieldsType is the discriminator for the different fields format and version. There is currently only one possible value: "FieldsV1" */
  fieldsType?: string;
  /** FieldsV1 holds the first JSON version format as described in the "FieldsV1" type. */
  fieldsV1?: FieldsV1;
  /** Manager is an identifier of the workflow managing these fields. */
  manager?: string;
  /** Operation is the type of operation which lead to this ManagedFieldsEntry being created. The only valid values for this field are 'Apply' and 'Update'. */
  operation?: string;
  /** Subresource is the name of the subresource used to update that object, or empty string if the object was updated through the main resource. The value of this field is used to distinguish between managers, even if they share the same name. For example, a status update will be distinct from a regular update using the same manager name. Note that the APIVersion field is not related to the Subresource field and it always corresponds to the version of the main resource. */
  subresource?: string;
  /** Time is the timestamp of when the ManagedFields entry was added. The timestamp will also be updated if a field is added, the manager changes any of the owned fields value or removes a field. The timestamp does not update when a field is removed from the entry because another manager took it over. */
  time?: Time;
};
export type OwnerReference = {
  /** API version of the referent. */
  apiVersion: string;
  /** If true, AND if the owner has the "foregroundDeletion" finalizer, then the owner cannot be deleted from the key-value store until this reference is removed. See https://kubernetes.io/docs/concepts/architecture/garbage-collection/#foreground-deletion for how the garbage collector interacts with this field and enforces the foreground deletion. Defaults to false. To set this field, a user needs "delete" permission of the owner, otherwise 422 (Unprocessable Entity) will be returned. */
  blockOwnerDeletion?: boolean;
  /** If true, this reference points to the managing controller. */
  controller?: boolean;
  /** Kind of the referent. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind: string;
  /** Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names */
  name: string;
  /** UID of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#uids */
  uid: string;
};
export type ObjectMeta = {
  /** Annotations is an unstructured key value map stored with a resource that may be set by external tools to store and retrieve arbitrary metadata. They are not queryable and should be preserved when modifying objects. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations */
  annotations?: {
    [key: string]: string;
  };
  /** CreationTimestamp is a timestamp representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations. Clients may not set this value. It is represented in RFC3339 form and is in UTC.
    
    Populated by the system. Read-only. Null for lists. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata */
  creationTimestamp?: Time;
  /** Number of seconds allowed for this object to gracefully terminate before it will be removed from the system. Only set when deletionTimestamp is also set. May only be shortened. Read-only. */
  deletionGracePeriodSeconds?: number;
  /** DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This field is set by the server when a graceful deletion is requested by the user, and is not directly settable by a client. The resource is expected to be deleted (no longer visible from resource lists, and not reachable by name) after the time in this field, once the finalizers list is empty. As long as the finalizers list contains items, deletion is blocked. Once the deletionTimestamp is set, this value may not be unset or be set further into the future, although it may be shortened or the resource may be deleted prior to this time. For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react by sending a graceful termination signal to the containers in the pod. After that 30 seconds, the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup, remove the pod from the API. In the presence of network partitions, this object may still exist after this timestamp, until an administrator or automated process can determine the resource is fully terminated. If not set, graceful deletion of the object has not been requested.
    
    Populated by the system when a graceful deletion is requested. Read-only. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata */
  deletionTimestamp?: Time;
  /** Must be empty before the object is deleted from the registry. Each entry is an identifier for the responsible component that will remove the entry from the list. If the deletionTimestamp of the object is non-nil, entries in this list can only be removed. Finalizers may be processed and removed in any order.  Order is NOT enforced because it introduces significant risk of stuck finalizers. finalizers is a shared field, any actor with permission can reorder it. If the finalizer list is processed in order, then this can lead to a situation in which the component responsible for the first finalizer in the list is waiting for a signal (field value, external system, or other) produced by a component responsible for a finalizer later in the list, resulting in a deadlock. Without enforced ordering finalizers are free to order amongst themselves and are not vulnerable to ordering changes in the list. */
  finalizers?: string[];
  /** GenerateName is an optional prefix, used by the server, to generate a unique name ONLY IF the Name field has not been provided. If this field is used, the name returned to the client will be different than the name passed. This value will also be combined with a unique suffix. The provided value has the same validation rules as the Name field, and may be truncated by the length of the suffix required to make the value unique on the server.
    
    If this field is specified and the generated name exists, the server will return a 409.
    
    Applied only if Name is not specified. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency */
  generateName?: string;
  /** A sequence number representing a specific generation of the desired state. Populated by the system. Read-only. */
  generation?: number;
  /** Map of string keys and values that can be used to organize and categorize (scope and select) objects. May match selectors of replication controllers and services. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels */
  labels?: {
    [key: string]: string;
  };
  /** ManagedFields maps workflow-id and version to the set of fields that are managed by that workflow. This is mostly for internal housekeeping, and users typically shouldn't need to set or understand this field. A workflow can be the user's name, a controller's name, or the name of a specific apply path like "ci-cd". The set of fields is always in the version that the workflow used when modifying the object. */
  managedFields?: ManagedFieldsEntry[];
  /** Name must be unique within a namespace. Is required when creating resources, although some resources may allow a client to request the generation of an appropriate name automatically. Name is primarily intended for creation idempotence and configuration definition. Cannot be updated. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#names */
  name?: string;
  /** Namespace defines the space within which each name must be unique. An empty namespace is equivalent to the "default" namespace, but "default" is the canonical representation. Not all objects are required to be scoped to a namespace - the value of this field for those objects will be empty.
    
    Must be a DNS_LABEL. Cannot be updated. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces */
  namespace?: string;
  /** List of objects depended by this object. If ALL objects in the list have been deleted, this object will be garbage collected. If this object is managed by a controller, then an entry in this list will point to this controller, with the controller field set to true. There cannot be more than one managing controller. */
  ownerReferences?: OwnerReference[];
  /** An opaque value that represents the internal version of this object that can be used by clients to determine when objects have changed. May be used for optimistic concurrency, change detection, and the watch operation on a resource or set of resources. Clients must treat these values as opaque and passed unmodified back to the server. They may only be valid for a particular resource or set of resources.
    
    Populated by the system. Read-only. Value must be treated as opaque by clients and . More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency */
  resourceVersion?: string;
  /** Deprecated: selfLink is a legacy read-only field that is no longer populated by the system. */
  selfLink?: string;
  /** UID is the unique in time and space value for this object. It is typically generated by the server on successful creation of a resource and is not allowed to change on PUT operations.
    
    Populated by the system. Read-only. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names#uids */
  uid?: string;
};
export type DashboardDataSourceRef = {
  /** The plugin type-id */
  type?: string;
  /** Specific datasource instance */
  uid?: string;
};
export type DashboardAnnotationPanelFilter = {
  /** Should the specified panels be included or excluded */
  exclude?: boolean;
  /** Panel IDs that should be included or excluded */
  ids: number[];
};
export type DashboardDataQueryKind = {
  /** The kind of a DataQueryKind is the datasource type */
  kind: string;
  spec: {
    [key: string]: object;
  };
};
export type DashboardAnnotationQuerySpec = {
  builtIn?: boolean;
  datasource?: DashboardDataSourceRef;
  enable: boolean;
  filter?: DashboardAnnotationPanelFilter;
  hide: boolean;
  iconColor: string;
  name: string;
  query?: DashboardDataQueryKind;
};
export type DashboardAnnotationQueryKind = {
  kind: string;
  spec: DashboardAnnotationQuerySpec;
};
export type DashboardLibraryPanelRef = {
  /** Library panel name */
  name: string;
  /** Library panel uid */
  uid: string;
};
export type DashboardLibraryPanelKindSpec = {
  /** Panel ID for the library panel in the dashboard */
  id: number;
  libraryPanel: DashboardLibraryPanelRef;
  /** Title for the library panel in the dashboard */
  title: string;
};
export type DashboardLibraryPanelKind = {
  kind: string;
  spec: DashboardLibraryPanelKindSpec;
};
export type DashboardPanelQuerySpec = {
  datasource?: DashboardDataSourceRef;
  hidden: boolean;
  query: DashboardDataQueryKind;
  refId: string;
};
export type DashboardPanelQueryKind = {
  kind: string;
  spec: DashboardPanelQuerySpec;
};
export type DashboardQueryOptionsSpec = {
  cacheTimeout?: string;
  hideTimeOverride?: boolean;
  interval?: string;
  maxDataPoints?: number;
  queryCachingTTL?: number;
  timeFrom?: string;
  timeShift?: string;
};
export type DashboardMatcherConfig = {
  /** The matcher id. This is used to find the matcher implementation from registry. */
  id: string;
  /** The matcher options. This is specific to the matcher implementation. */
  options?: object;
};
export type DashboardDataTransformerConfig = {
  /** Disabled transformations are skipped */
  disabled?: boolean;
  /** Optional frame matcher. When missing it will be applied to all results */
  filter?: DashboardMatcherConfig;
  /** Unique identifier of transformer */
  id: string;
  /** Options to be passed to the transformer Valid options depend on the transformer id */
  options: object;
  /** Where to pull DataFrames from as input to transformation */
  topic?: string;
};
export type DashboardTransformationKind = {
  /** The kind of a TransformationKind is the transformation ID */
  kind: string;
  spec: DashboardDataTransformerConfig;
};
export type DashboardQueryGroupSpec = {
  queries: DashboardPanelQueryKind[];
  queryOptions: DashboardQueryOptionsSpec;
  transformations: DashboardTransformationKind[];
};
export type DashboardQueryGroupKind = {
  kind: string;
  spec: DashboardQueryGroupSpec;
};
export type DashboardDataLink = {
  targetBlank?: boolean;
  title: string;
  url: string;
};
export type DashboardFieldColor = {
  /** The fixed color value for fixed or shades color modes. */
  fixedColor?: string;
  /** The main color scheme mode. */
  mode: string;
  /** Some visualizations need to know how to assign a series color from by value color schemes. */
  seriesBy?: string;
};
export type DashboardValueMappingResult = {
  /** Text to use when the value matches */
  color?: string;
  /** Icon to display when the value matches. Only specific visualizations. */
  icon?: string;
  /** Position in the mapping array. Only used internally. */
  index?: number;
  /** Text to display when the value matches */
  text?: string;
};
export type DashboardV2Alpha1RangeMapOptions = {
  /** Min value of the range. It can be null which means -Infinity */
  from: number;
  /** Config to apply when the value is within the range */
  result: DashboardValueMappingResult;
  /** Max value of the range. It can be null which means +Infinity */
  to: number;
};
export type DashboardRangeMap = {
  /** Range to match against and the result to apply when the value is within the range */
  options: DashboardV2Alpha1RangeMapOptions;
  type: string;
};
export type DashboardV2Alpha1RegexMapOptions = {
  /** Regular expression to match against */
  pattern: string;
  /** Config to apply when the value matches the regex */
  result: DashboardValueMappingResult;
};
export type DashboardRegexMap = {
  /** Regular expression to match against and the result to apply when the value matches the regex */
  options: DashboardV2Alpha1RegexMapOptions;
  type: string;
};
export type DashboardV2Alpha1SpecialValueMapOptions = {
  /** Special value to match against */
  match: string;
  /** Config to apply when the value matches the special value */
  result: DashboardValueMappingResult;
};
export type DashboardSpecialValueMap = {
  options: DashboardV2Alpha1SpecialValueMapOptions;
  type: string;
};
export type DashboardValueMap = {
  /** Map with <value_to_match>: ValueMappingResult. For example: { "10": { text: "Perfection!", color: "green" } } */
  options: {
    [key: string]: DashboardValueMappingResult;
  };
  type: string;
};
export type DashboardValueMapOrRangeMapOrRegexMapOrSpecialValueMap = {
  RangeMap?: DashboardRangeMap;
  RegexMap?: DashboardRegexMap;
  SpecialValueMap?: DashboardSpecialValueMap;
  ValueMap?: DashboardValueMap;
};
export type DashboardThreshold = {
  color: string;
  value: number;
};
export type DashboardThresholdsConfig = {
  mode: string;
  steps: DashboardThreshold[];
};
export type DashboardFieldConfig = {
  /** Panel color configuration */
  color?: DashboardFieldColor;
  /** custom is specified by the FieldConfig field in panel plugin schemas. */
  custom?: {
    [key: string]: object;
  };
  /** Specify the number of decimals Grafana includes in the rendered value. If you leave this field blank, Grafana automatically truncates the number of decimals based on the value. For example 1.1234 will display as 1.12 and 100.456 will display as 100. To display all decimals, set the unit to `String`. */
  decimals?: number;
  /** Human readable field metadata */
  description?: string;
  /** The display value for this field.  This supports template variables blank is auto */
  displayName?: string;
  /** This can be used by data sources that return and explicit naming structure for values and labels When this property is configured, this value is used rather than the default naming strategy. */
  displayNameFromDS?: string;
  /** True if data source field supports ad-hoc filters */
  filterable?: boolean;
  /** The behavior when clicking on a result */
  links?: object[];
  /** Convert input values into a display string */
  mappings?: DashboardValueMapOrRangeMapOrRegexMapOrSpecialValueMap[];
  /** The maximum value used in percentage threshold calculations. Leave blank for auto calculation based on all series and fields. */
  max?: number;
  /** The minimum value used in percentage threshold calculations. Leave blank for auto calculation based on all series and fields. */
  min?: number;
  /** Alternative to empty string */
  noValue?: string;
  /** An explicit path to the field in the datasource.  When the frame meta includes a path, This will default to `${frame.meta.path}/${field.name}
    
    When defined, this value can be used as an identifier within the datasource scope, and may be used to update the results */
  path?: string;
  /** Map numeric values to states */
  thresholds?: DashboardThresholdsConfig;
  /** Unit a field should use. The unit you select is applied to all fields except time. You can use the units ID availables in Grafana or a custom unit. Available units in Grafana: https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/valueFormats/categories.ts As custom unit, you can use the following formats: `suffix:<suffix>` for custom unit that should go after value. `prefix:<prefix>` for custom unit that should go before value. `time:<format>` For custom date time formats type for example `time:YYYY-MM-DD`. `si:<base scale><unit characters>` for custom SI units. For example: `si: mF`. This one is a bit more advanced as you can specify both a unit and the source data scale. So if your source data is represented as milli (thousands of) something prefix the unit with that SI scale character. `count:<unit>` for a custom count unit. `currency:<unit>` for custom a currency unit. */
  unit?: string;
  /** True if data source can write a value to the path. Auth/authz are supported separately */
  writeable?: boolean;
};
export type DashboardDynamicConfigValue = {
  id: string;
  value?: object;
};
export type DashboardV2Alpha1FieldConfigSourceOverrides = {
  matcher: DashboardMatcherConfig;
  properties: DashboardDynamicConfigValue[];
};
export type DashboardFieldConfigSource = {
  /** Defaults are the options applied to all fields. */
  defaults: DashboardFieldConfig;
  /** Overrides are the options applied to specific fields overriding the defaults. */
  overrides: DashboardV2Alpha1FieldConfigSourceOverrides[];
};
export type DashboardVizConfigSpec = {
  fieldConfig: DashboardFieldConfigSource;
  options: {
    [key: string]: object;
  };
  pluginVersion: string;
};
export type DashboardVizConfigKind = {
  /** The kind of a VizConfigKind is the plugin ID */
  kind: string;
  spec: DashboardVizConfigSpec;
};
export type DashboardPanelSpec = {
  data: DashboardQueryGroupKind;
  description: string;
  id: number;
  links: DashboardDataLink[];
  title: string;
  transparent?: boolean;
  vizConfig: DashboardVizConfigKind;
};
export type DashboardPanelKind = {
  kind: string;
  spec: DashboardPanelSpec;
};
export type DashboardPanelKindOrLibraryPanelKind = {
  LibraryPanelKind?: DashboardLibraryPanelKind;
  PanelKind?: DashboardPanelKind;
};
export type DashboardConditionalRenderingDataSpec = {
  value: boolean;
};
export type DashboardConditionalRenderingDataKind = {
  kind: string;
  spec: DashboardConditionalRenderingDataSpec;
};
export type DashboardConditionalRenderingTimeRangeSizeSpec = {
  value: string;
};
export type DashboardConditionalRenderingTimeRangeSizeKind = {
  kind: string;
  spec: DashboardConditionalRenderingTimeRangeSizeSpec;
};
export type DashboardConditionalRenderingVariableSpec = {
  operator: string;
  value: string;
  variable: string;
};
export type DashboardConditionalRenderingVariableKind = {
  kind: string;
  spec: DashboardConditionalRenderingVariableSpec;
};
export type DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind =
  {
    ConditionalRenderingDataKind?: DashboardConditionalRenderingDataKind;
    ConditionalRenderingTimeRangeSizeKind?: DashboardConditionalRenderingTimeRangeSizeKind;
    ConditionalRenderingVariableKind?: DashboardConditionalRenderingVariableKind;
  };
export type DashboardConditionalRenderingGroupSpec = {
  condition: string;
  items: DashboardConditionalRenderingVariableKindOrConditionalRenderingDataKindOrConditionalRenderingTimeRangeSizeKind[];
  visibility: string;
};
export type DashboardConditionalRenderingGroupKind = {
  kind: string;
  spec: DashboardConditionalRenderingGroupSpec;
};
export type DashboardElementReference = {
  kind: string;
  name: string;
};
export type DashboardAutoGridRepeatOptions = {
  mode: string;
  value: string;
};
export type DashboardAutoGridLayoutItemSpec = {
  conditionalRendering?: DashboardConditionalRenderingGroupKind;
  element: DashboardElementReference;
  repeat?: DashboardAutoGridRepeatOptions;
};
export type DashboardAutoGridLayoutItemKind = {
  kind: string;
  spec: DashboardAutoGridLayoutItemSpec;
};
export type DashboardAutoGridLayoutSpec = {
  columnWidth?: number;
  columnWidthMode: string;
  fillScreen?: boolean;
  items: DashboardAutoGridLayoutItemKind[];
  maxColumnCount?: number;
  rowHeight?: number;
  rowHeightMode: string;
};
export type DashboardAutoGridLayoutKind = {
  kind: string;
  spec: DashboardAutoGridLayoutSpec;
};
export type DashboardRepeatOptions = {
  direction?: string;
  maxPerRow?: number;
  mode: string;
  value: string;
};
export type DashboardGridLayoutItemSpec = {
  /** reference to a PanelKind from dashboard.spec.elements Expressed as JSON Schema reference */
  element: DashboardElementReference;
  height: number;
  repeat?: DashboardRepeatOptions;
  width: number;
  x: number;
  y: number;
};
export type DashboardGridLayoutItemKind = {
  kind: string;
  spec: DashboardGridLayoutItemSpec;
};
export type DashboardRowRepeatOptions = {
  mode: string;
  value: string;
};
export type DashboardGridLayoutRowSpec = {
  collapsed: boolean;
  /** Grid items in the row will have their Y value be relative to the rows Y value. This means a panel positioned at Y: 0 in a row with Y: 10 will be positioned at Y: 11 (row header has a heigh of 1) in the dashboard. */
  elements: DashboardGridLayoutItemKind[];
  repeat?: DashboardRowRepeatOptions;
  title: string;
  y: number;
};
export type DashboardGridLayoutRowKind = {
  kind: string;
  spec: DashboardGridLayoutRowSpec;
};
export type DashboardGridLayoutItemKindOrGridLayoutRowKind = {
  GridLayoutItemKind?: DashboardGridLayoutItemKind;
  GridLayoutRowKind?: DashboardGridLayoutRowKind;
};
export type DashboardGridLayoutSpec = {
  items: DashboardGridLayoutItemKindOrGridLayoutRowKind[];
};
export type DashboardGridLayoutKind = {
  kind: string;
  spec: DashboardGridLayoutSpec;
};
export type DashboardTabsLayoutTabSpec = {
  conditionalRendering?: DashboardConditionalRenderingGroupKind;
  layout: DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind;
  title?: string;
};
export type DashboardTabsLayoutTabKind = {
  kind: string;
  spec: DashboardTabsLayoutTabSpec;
};
export type DashboardTabsLayoutSpec = {
  tabs: DashboardTabsLayoutTabKind[];
};
export type DashboardTabsLayoutKind = {
  kind: string;
  spec: DashboardTabsLayoutSpec;
};
export type DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind = {
  AutoGridLayoutKind?: DashboardAutoGridLayoutKind;
  GridLayoutKind?: DashboardGridLayoutKind;
  RowsLayoutKind?: DashboardRowsLayoutKind;
  TabsLayoutKind?: DashboardTabsLayoutKind;
};
export type DashboardRowsLayoutRowSpec = {
  collapse?: boolean;
  conditionalRendering?: DashboardConditionalRenderingGroupKind;
  fillScreen?: boolean;
  hideHeader?: boolean;
  layout: DashboardGridLayoutKindOrAutoGridLayoutKindOrTabsLayoutKindOrRowsLayoutKind;
  repeat?: DashboardRowRepeatOptions;
  title?: string;
};
export type DashboardRowsLayoutRowKind = {
  kind: string;
  spec: DashboardRowsLayoutRowSpec;
};
export type DashboardRowsLayoutSpec = {
  rows: DashboardRowsLayoutRowKind[];
};
export type DashboardRowsLayoutKind = {
  kind: string;
  spec: DashboardRowsLayoutSpec;
};
export type DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind = {
  AutoGridLayoutKind?: DashboardAutoGridLayoutKind;
  GridLayoutKind?: DashboardGridLayoutKind;
  RowsLayoutKind?: DashboardRowsLayoutKind;
  TabsLayoutKind?: DashboardTabsLayoutKind;
};
export type DashboardDashboardLink = {
  /** If true, all dashboards links will be displayed in a dropdown. If false, all dashboards links will be displayed side by side. Only valid if the type is dashboards */
  asDropdown: boolean;
  /** Icon name to be displayed with the link */
  icon: string;
  /** If true, includes current template variables values in the link as query params */
  includeVars: boolean;
  /** If true, includes current time range in the link as query params */
  keepTime: boolean;
  /** List of tags to limit the linked dashboards. If empty, all dashboards will be displayed. Only valid if the type is dashboards */
  tags: string[];
  /** If true, the link will be opened in a new tab */
  targetBlank: boolean;
  /** Title to display with the link */
  title: string;
  /** Tooltip to display when the user hovers their mouse over it */
  tooltip: string;
  /** Link type. Accepted values are dashboards (to refer to another dashboard) and link (to refer to an external resource) FIXME: The type is generated as `type: DashboardLinkType | dashboardLinkType.Link;` but it should be `type: DashboardLinkType` */
  type: string;
  /** Link URL. Only required/valid if the type is link */
  url?: string;
};
export type DashboardTimeRangeOption = {
  display: string;
  from: string;
  to: string;
};
export type DashboardTimeSettingsSpec = {
  /** Refresh rate of dashboard. Represented via interval string, e.g. "5s", "1m", "1h", "1d". v1: refresh */
  autoRefresh: string;
  /** Interval options available in the refresh picker dropdown. v1: timepicker.refresh_intervals */
  autoRefreshIntervals: string[];
  /** The month that the fiscal year starts on. 0 = January, 11 = December */
  fiscalYearStartMonth: number;
  /** Start time range for dashboard. Accepted values are relative time strings like "now-6h" or absolute time strings like "2020-07-10T08:00:00.000Z". */
  from: string;
  /** Whether timepicker is visible or not. v1: timepicker.hidden */
  hideTimepicker: boolean;
  /** Override the now time by entering a time delay. Use this option to accommodate known delays in data aggregation to avoid null values. v1: timepicker.nowDelay */
  nowDelay?: string;
  /** Selectable options available in the time picker dropdown. Has no effect on provisioned dashboard. v1: timepicker.quick_ranges , not exposed in the UI */
  quickRanges?: DashboardTimeRangeOption[];
  /** Timezone of dashboard. Accepted values are IANA TZDB zone ID or "browser" or "utc". */
  timezone?: string;
  /** End time range for dashboard. Accepted values are relative time strings like "now-6h" or absolute time strings like "2020-07-10T08:00:00.000Z". */
  to: string;
  /** Day when the week starts. Expressed by the name of the day in lowercase, e.g. "monday". */
  weekStart?: string;
};
export type DashboardAdHocFilterWithLabels = {
  /** @deprecated */
  condition?: string;
  forceEdit?: boolean;
  key: string;
  keyLabel?: string;
  operator: string;
  value: string;
  valueLabels?: string[];
  values?: string[];
};
export type DashboardStringOrFloat64 = {
  Float64?: number;
  String?: string;
};
export type DashboardMetricFindValue = {
  expandable?: boolean;
  group?: string;
  text: string;
  value?: DashboardStringOrFloat64;
};
export type DashboardAdhocVariableSpec = {
  baseFilters: DashboardAdHocFilterWithLabels[];
  datasource?: DashboardDataSourceRef;
  defaultKeys: DashboardMetricFindValue[];
  description?: string;
  filters: DashboardAdHocFilterWithLabels[];
  hide: string;
  label?: string;
  name: string;
  skipUrlSync: boolean;
};
export type DashboardAdhocVariableKind = {
  kind: string;
  spec: DashboardAdhocVariableSpec;
};
export type DashboardStringOrArrayOfString = {
  ArrayOfString?: string[];
  String?: string;
};
export type DashboardVariableOption = {
  /** Whether the option is selected or not */
  selected?: boolean;
  /** Text to be displayed for the option */
  text: DashboardStringOrArrayOfString;
  /** Value of the option */
  value: DashboardStringOrArrayOfString;
};
export type DashboardConstantVariableSpec = {
  current: DashboardVariableOption;
  description?: string;
  hide: string;
  label?: string;
  name: string;
  query: string;
  skipUrlSync: boolean;
};
export type DashboardConstantVariableKind = {
  kind: string;
  spec: DashboardConstantVariableSpec;
};
export type DashboardCustomVariableSpec = {
  allValue?: string;
  current: DashboardVariableOption;
  description?: string;
  hide: string;
  includeAll: boolean;
  label?: string;
  multi: boolean;
  name: string;
  options: DashboardVariableOption[];
  query: string;
  skipUrlSync: boolean;
};
export type DashboardCustomVariableKind = {
  kind: string;
  spec: DashboardCustomVariableSpec;
};
export type DashboardDatasourceVariableSpec = {
  allValue?: string;
  current: DashboardVariableOption;
  description?: string;
  hide: string;
  includeAll: boolean;
  label?: string;
  multi: boolean;
  name: string;
  options: DashboardVariableOption[];
  pluginId: string;
  refresh: string;
  regex: string;
  skipUrlSync: boolean;
};
export type DashboardDatasourceVariableKind = {
  kind: string;
  spec: DashboardDatasourceVariableSpec;
};
export type DashboardGroupByVariableSpec = {
  current: DashboardVariableOption;
  datasource?: DashboardDataSourceRef;
  description?: string;
  hide: string;
  label?: string;
  multi: boolean;
  name: string;
  options: DashboardVariableOption[];
  skipUrlSync: boolean;
};
export type DashboardGroupByVariableKind = {
  kind: string;
  spec: DashboardGroupByVariableSpec;
};
export type DashboardIntervalVariableSpec = {
  auto: boolean;
  auto_count: number;
  auto_min: string;
  current: DashboardVariableOption;
  description?: string;
  hide: string;
  label?: string;
  name: string;
  options: DashboardVariableOption[];
  query: string;
  refresh: string;
  skipUrlSync: boolean;
};
export type DashboardIntervalVariableKind = {
  kind: string;
  spec: DashboardIntervalVariableSpec;
};
export type DashboardQueryVariableSpec = {
  allValue?: string;
  current: DashboardVariableOption;
  datasource?: DashboardDataSourceRef;
  definition?: string;
  description?: string;
  hide: string;
  includeAll: boolean;
  label?: string;
  multi: boolean;
  name: string;
  options: DashboardVariableOption[];
  placeholder?: string;
  query: DashboardDataQueryKind;
  refresh: string;
  regex: string;
  skipUrlSync: boolean;
  sort: string;
};
export type DashboardQueryVariableKind = {
  kind: string;
  spec: DashboardQueryVariableSpec;
};
export type DashboardTextVariableSpec = {
  current: DashboardVariableOption;
  description?: string;
  hide: string;
  label?: string;
  name: string;
  query: string;
  skipUrlSync: boolean;
};
export type DashboardTextVariableKind = {
  kind: string;
  spec: DashboardTextVariableSpec;
};
export type DashboardQueryVariableKindOrTextVariableKindOrConstantVariableKindOrDatasourceVariableKindOrIntervalVariableKindOrCustomVariableKindOrGroupByVariableKindOrAdhocVariableKind =
  {
    AdhocVariableKind?: DashboardAdhocVariableKind;
    ConstantVariableKind?: DashboardConstantVariableKind;
    CustomVariableKind?: DashboardCustomVariableKind;
    DatasourceVariableKind?: DashboardDatasourceVariableKind;
    GroupByVariableKind?: DashboardGroupByVariableKind;
    IntervalVariableKind?: DashboardIntervalVariableKind;
    QueryVariableKind?: DashboardQueryVariableKind;
    TextVariableKind?: DashboardTextVariableKind;
  };
export type DashboardSpec = {
  /** Title of dashboard. */
  annotations: DashboardAnnotationQueryKind[];
  /** Configuration of dashboard cursor sync behavior. "Off" for no shared crosshair or tooltip (default). "Crosshair" for shared crosshair. "Tooltip" for shared crosshair AND shared tooltip. */
  cursorSync: string;
  /** Description of dashboard. */
  description?: string;
  /** Whether a dashboard is editable or not. */
  editable?: boolean;
  elements: {
    [key: string]: DashboardPanelKindOrLibraryPanelKind;
  };
  layout: DashboardGridLayoutKindOrRowsLayoutKindOrAutoGridLayoutKindOrTabsLayoutKind;
  /** Links with references to other dashboards or external websites. */
  links: DashboardDashboardLink[];
  /** When set to true, the dashboard will redraw panels at an interval matching the pixel width. This will keep data "moving left" regardless of the query refresh rate. This setting helps avoid dashboards presenting stale live data. */
  liveNow?: boolean;
  /** When set to true, the dashboard will load all panels in the dashboard when it's loaded. */
  preload: boolean;
  /** Plugins only. The version of the dashboard installed together with the plugin. This is used to determine if the dashboard should be updated when the plugin is updated. */
  revision?: number;
  /** Tags associated with dashboard. */
  tags: string[];
  timeSettings: DashboardTimeSettingsSpec;
  /** Title of dashboard. */
  title: string;
  /** Configured template variables. */
  variables: DashboardQueryVariableKindOrTextVariableKindOrConstantVariableKindOrDatasourceVariableKindOrIntervalVariableKindOrCustomVariableKindOrGroupByVariableKindOrAdhocVariableKind[];
};
export type DashboardConversionStatus = {
  /** The error message from the conversion. Empty if the conversion has not failed. */
  error: string;
  /** Whether from another version has failed. If true, means that the dashboard is not valid, and the caller should instead fetch the stored version. */
  failed: boolean;
  /** The version which was stored when the dashboard was created / updated. Fetching this version should always succeed. */
  storedVersion: string;
};
export type DashboardStatus = {
  /** Optional conversion status. */
  conversion?: DashboardConversionStatus;
};
export type Dashboard = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  metadata: ObjectMeta;
  /** Spec is the spec of the Dashboard */
  spec: DashboardSpec;
  status: DashboardStatus;
};
export const { useGetDashboardQuery } = injectedRtkApi;
