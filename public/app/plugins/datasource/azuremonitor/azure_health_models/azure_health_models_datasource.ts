import { defer, from, type Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  type DataFrame,
  type DataQueryRequest,
  type DataQueryResponse,
  type DataSourceInstanceSettings,
  dateTimeFormat,
  FieldType,
  LoadingState,
  MappingType,
  type ScopedVars,
  toDataFrame,
} from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv, type TemplateSrv } from '@grafana/runtime';
import { TableCellDisplayMode } from '@grafana/schema';

import { type AzureMonitorQuery } from '../types/query';
import { type AzureMonitorDataSourceJsonData } from '../types/types';
import { fetchAllArmPages, routeNames } from '../utils/common';

import { getEntityHealthMetrics } from './entityHealthMetrics';
import {
  type ArmListResponse,
  HEALTH_MODELS_API_VERSION,
  type HealthModel,
  type HealthModelEntity,
  type HealthModelRelationship,
  type HealthModelResourceId,
} from './types';

export default class AzureHealthModelsDatasource extends DataSourceWithBackend<
  AzureMonitorQuery,
  AzureMonitorDataSourceJsonData
> {
  private readonly resourcePath = routeNames.azureMonitor;

  constructor(
    instanceSettings: DataSourceInstanceSettings<AzureMonitorDataSourceJsonData>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
  }

  filterQuery(query: AzureMonitorQuery): boolean {
    return Boolean(query.azureHealthModels?.healthModelId);
  }

  applyTemplateVariables(target: AzureMonitorQuery, scopedVars: ScopedVars): AzureMonitorQuery {
    const healthModelId = target.azureHealthModels?.healthModelId;
    return {
      ...target,
      subscription: target.subscription ? this.templateSrv.replace(target.subscription, scopedVars) : undefined,
      azureHealthModels: {
        ...target.azureHealthModels,
        healthModelId: healthModelId ? this.templateSrv.replace(healthModelId, scopedVars) : undefined,
      },
    };
  }

  query(options: DataQueryRequest<AzureMonitorQuery>): Observable<DataQueryResponse> {
    return defer(() => from(this.loadFrames(options.targets))).pipe(
      map((data) => ({
        data,
        state: LoadingState.Done,
      }))
    );
  }

  async getHealthModels(subscriptionId: string): Promise<HealthModel[]> {
    const collectionPath = `/subscriptions/${subscriptionId}/providers/Microsoft.CloudHealth/healthmodels`;
    return fetchAllArmPages<HealthModel>(
      this.resourcePath,
      `${this.resourcePath}${collectionPath}?api-version=${HEALTH_MODELS_API_VERSION}`,
      (path) => this.getResource<ArmListResponse<HealthModel>>(path)
    );
  }

  private async loadFrames(targets: AzureMonitorQuery[]): Promise<DataFrame[]> {
    const targetFrames = await Promise.all(
      targets.map(async (target) => {
        const healthModelId = target.azureHealthModels?.healthModelId;
        if (!healthModelId) {
          return [];
        }

        const resourceId = parseHealthModelResourceId(healthModelId);
        if (target.subscription && resourceId.subscriptionId.toLowerCase() !== target.subscription.toLowerCase()) {
          throw new Error('The selected Health Model does not belong to the selected subscription.');
        }

        const [healthModel, entities, relationships] = await Promise.all([
          this.getResource<HealthModel>(`${this.resourcePath}${healthModelId}`, {
            'api-version': HEALTH_MODELS_API_VERSION,
          }),
          this.listCollection<HealthModelEntity>(`${healthModelId}/entities`),
          this.listCollection<HealthModelRelationship>(`${healthModelId}/relationships`),
        ]);

        if (target.azureHealthModels?.resultFormat === 'modelGraph') {
          // Node Graph needs nodes and edges together and nothing else, so a mixed response would
          // just be ignored.
          return nodeGraphFrames(target.refId, entities, relationships);
        }

        return [
          entitiesFrame(target.refId, entities),
          healthModelFrame(target.refId, healthModel),
          relationshipsFrame(target.refId, relationships),
        ];
      })
    );

    return targetFrames.flat();
  }

  private listCollection<T>(collectionPath: string): Promise<T[]> {
    return fetchAllArmPages<T>(
      this.resourcePath,
      `${this.resourcePath}${collectionPath}?api-version=${HEALTH_MODELS_API_VERSION}`,
      (path) => this.getResource<ArmListResponse<T>>(path)
    );
  }
}

export function parseHealthModelResourceId(healthModelId: string): HealthModelResourceId {
  const match =
    /^\/subscriptions\/([^/]+)\/resourceGroups\/([^/]+)\/providers\/Microsoft\.CloudHealth\/healthmodels\/([^/?#]+)$/i.exec(
      healthModelId
    );

  if (!match) {
    throw new Error('The selected value is not a valid Microsoft.CloudHealth Health Model resource ID.');
  }

  const [, subscriptionId, resourceGroupName, healthModelName] = match;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subscriptionId) ||
    resourceGroupName === '.' ||
    resourceGroupName === '..' ||
    healthModelName === '.' ||
    healthModelName === '..' ||
    /%(2f|5c)/i.test(resourceGroupName) ||
    /%(2f|5c)/i.test(healthModelName)
  ) {
    throw new Error('The selected value is not a valid Microsoft.CloudHealth Health Model resource ID.');
  }

  return {
    subscriptionId,
    resourceGroupName,
    healthModelName,
  };
}

function healthModelFrame(refId: string, healthModel: HealthModel): DataFrame {
  return toDataFrame({
    name: 'Health Model',
    refId,
    fields: [
      { name: 'id', type: FieldType.string, values: [healthModel.id] },
      { name: 'name', type: FieldType.string, values: [healthModel.name] },
      { name: 'location', type: FieldType.string, values: [healthModel.location] },
      {
        name: 'provisioningState',
        type: FieldType.string,
        values: [healthModel.properties?.provisioningState],
      },
      {
        name: 'tags',
        type: FieldType.string,
        values: [healthModel.tags ? JSON.stringify(healthModel.tags) : undefined],
      },
    ],
  });
}

/**
 * Health states in a fixed order, so the enum field's numeric values are stable. The order runs
 * healthiest to least healthy, which is also a sensible sort order in a table.
 */
const HEALTH_STATES = ['Healthy', 'Degraded', 'Unhealthy', 'Unknown', 'Deleted'];
const HEALTH_STATE_TEXT_COLORS = ['green', 'orange', 'red', 'gray', 'gray'];

function entitiesFrame(refId: string, entities: HealthModelEntity[]): DataFrame {
  const metrics = entities.map((entity) => getEntityHealthMetrics(entity));

  return toDataFrame({
    name: 'Entities',
    refId,
    meta: {
      preferredVisualisationType: 'table',
    },
    fields: [
      {
        // Relationships reference entities by `name`, not `displayName`, and `displayName` is not
        // unique within a model. Keeping `name` on the frame is what lets the two be joined, for
        // example to drive a node graph. It is hidden so the default table stays readable.
        name: 'name',
        type: FieldType.string,
        values: entities.map((entity) => entity.name),
        config: { custom: { hidden: true } },
      },
      {
        name: 'displayName',
        type: FieldType.string,
        values: entities.map((entity) => entity.properties?.displayName),
      },
      {
        name: 'healthState',
        type: FieldType.string,
        values: entities.map((entity) => entity.properties?.healthState),
        config: {
          custom: {
            cellOptions: {
              type: TableCellDisplayMode.ColorText,
            },
          },
          mappings: [
            {
              type: MappingType.ValueToText,
              options: {
                Healthy: { text: 'Healthy', color: 'green' },
                Degraded: { text: 'Degraded', color: 'orange' },
                Unhealthy: { text: 'Unhealthy', color: 'red' },
                Unknown: { text: 'Unknown', color: 'gray' },
                Deleted: { text: 'Deleted', color: 'gray' },
              },
            },
          ],
        },
      },
      {
        // The string state above is only usable by the table. This enum carries the same value as
        // a number with its own text and colours, which is what Stat, Gauge, Bar gauge and Pie
        // chart need in order to show health at all. Hidden so the table does not show it twice.
        name: 'healthStateValue',
        type: FieldType.enum,
        values: entities.map((entity) => {
          const index = HEALTH_STATES.indexOf(entity.properties?.healthState ?? 'Unknown');
          return index === -1 ? HEALTH_STATES.indexOf('Unknown') : index;
        }),
        config: {
          displayName: 'Health state',
          custom: { hidden: true },
          type: { enum: { text: HEALTH_STATES, color: HEALTH_STATE_TEXT_COLORS } },
        },
      },
      {
        // Deliberately a string, not a time field. This frame is a point-in-time snapshot: every
        // row is a different entity, not a step in a series. Typing this as `time` makes Grafana
        // treat it as an x-axis, so a time series panel strings unrelated entities into a line and
        // invents a trend that does not exist. Entity history comes from the data plane instead.
        name: 'lastCheckedAt',
        type: FieldType.string,
        values: metrics.map((metric) => (metric.lastCheckedAt ? dateTimeFormat(metric.lastCheckedAt) : null)),
        config: { displayName: 'Last checked' },
      },
      {
        name: 'signalsHealthy',
        type: FieldType.number,
        values: metrics.map(
          (metric) => metric.signals.filter((signal) => signal.healthState?.toLowerCase() === 'healthy').length
        ),
        config: { displayName: 'Healthy signals' },
      },
      {
        name: 'signalsTotal',
        type: FieldType.number,
        values: metrics.map((metric) => metric.signals.length),
        config: { displayName: 'Total signals' },
      },
      {
        name: 'availabilityState',
        type: FieldType.string,
        values: metrics.map((metric) => metric.availabilityState ?? null),
        config: { displayName: 'Availability' },
      },
      {
        name: 'alertSeverities',
        type: FieldType.string,
        values: metrics.map((metric) => (metric.alertSeverities.length ? metric.alertSeverities.join(', ') : null)),
        config: { displayName: 'Alerts' },
      },
      {
        name: 'impact',
        type: FieldType.string,
        values: entities.map((entity) => entity.properties?.impact ?? null),
        config: { displayName: 'Impact' },
      },
      {
        name: 'healthObjective',
        type: FieldType.number,
        values: entities.map((entity) => entity.properties?.healthObjective ?? null),
        config: { displayName: 'Health objective', unit: 'percent' },
      },
      {
        name: 'provisioningState',
        type: FieldType.string,
        values: entities.map((entity) => entity.properties?.provisioningState ?? null),
        config: { displayName: 'Provisioning state' },
      },
    ],
  });
}


/** Health state colours, fixed because frames are built outside React and have no theme access. */
const HEALTH_STATE_COLORS: Record<string, string> = {
  healthy: '#3FB950',
  degraded: '#D29922',
  unhealthy: '#F85149',
  unknown: '#8B949E',
};

/**
 * Builds the two frames the Node Graph panel expects: nodes keyed by `id`, and edges referencing
 * those ids through `source` and `target`.
 *
 * Entities are keyed by `name` rather than `displayName` because relationships reference names and
 * display names are not unique within a model.
 */
function nodeGraphFrames(
  refId: string,
  entities: HealthModelEntity[],
  relationships: HealthModelRelationship[]
): DataFrame[] {
  const metrics = new Map(entities.map((entity) => [entity.name, getEntityHealthMetrics(entity)]));
  const known = new Set(entities.map((entity) => entity.name));

  // An edge to an entity outside the model would render as a ghost node with no health state.
  const edges = relationships.filter((relationship) => {
    const parent = relationship.properties?.parentEntityName;
    const child = relationship.properties?.childEntityName;
    return parent && child && known.has(parent) && known.has(child);
  });

  const nodes = toDataFrame({
    name: 'nodes',
    refId,
    meta: { preferredVisualisationType: 'nodeGraph' },
    fields: [
      { name: 'id', type: FieldType.string, values: entities.map((entity) => entity.name) },
      {
        name: 'title',
        type: FieldType.string,
        values: entities.map((entity) => entity.properties?.displayName ?? entity.name),
      },
      {
        name: 'subtitle',
        type: FieldType.string,
        values: entities.map((entity) => entity.properties?.healthState ?? 'Unknown'),
      },
      {
        name: 'mainstat',
        type: FieldType.string,
        values: entities.map((entity) => {
          const metric = metrics.get(entity.name);
          if (!metric?.signals.length) {
            return entity.properties?.healthState ?? 'Unknown';
          }
          const healthy = metric.signals.filter(
            (signal) => signal.healthState?.toLowerCase() === 'healthy'
          ).length;
          return `${healthy}/${metric.signals.length} signals`;
        }),
      },
      {
        name: 'color',
        type: FieldType.string,
        values: entities.map(
          (entity) =>
            HEALTH_STATE_COLORS[(entity.properties?.healthState ?? 'unknown').toLowerCase()] ??
            HEALTH_STATE_COLORS.unknown
        ),
      },
      {
        name: 'detail__impact',
        type: FieldType.string,
        values: entities.map((entity) => entity.properties?.impact ?? '--'),
        config: { displayName: 'Impact' },
      },
      {
        name: 'detail__alerts',
        type: FieldType.string,
        values: entities.map((entity) => metrics.get(entity.name)?.alertSeverities.join(', ') || '--'),
        config: { displayName: 'Alerts' },
      },
    ],
  });

  const edgeFrame = toDataFrame({
    name: 'edges',
    refId,
    meta: { preferredVisualisationType: 'nodeGraph' },
    fields: [
      { name: 'id', type: FieldType.string, values: edges.map((relationship) => relationship.name) },
      {
        name: 'source',
        type: FieldType.string,
        values: edges.map((relationship) => relationship.properties!.parentEntityName!),
      },
      {
        name: 'target',
        type: FieldType.string,
        values: edges.map((relationship) => relationship.properties!.childEntityName!),
      },
      {
        name: 'mainstat',
        type: FieldType.string,
        values: edges.map((relationship) => relationship.properties?.displayName ?? relationship.name),
      },
    ],
  });

  return [nodes, edgeFrame];
}

function relationshipsFrame(refId: string, relationships: HealthModelRelationship[]): DataFrame {
  return toDataFrame({
    name: 'Relationships',
    refId,
    fields: [
      { name: 'id', type: FieldType.string, values: relationships.map((relationship) => relationship.id) },
      { name: 'name', type: FieldType.string, values: relationships.map((relationship) => relationship.name) },
      {
        name: 'displayName',
        type: FieldType.string,
        values: relationships.map((relationship) => relationship.properties?.displayName),
      },
      {
        name: 'parentEntityName',
        type: FieldType.string,
        values: relationships.map((relationship) => relationship.properties?.parentEntityName),
      },
      {
        name: 'childEntityName',
        type: FieldType.string,
        values: relationships.map((relationship) => relationship.properties?.childEntityName),
      },
      {
        name: 'provisioningState',
        type: FieldType.string,
        values: relationships.map((relationship) => relationship.properties?.provisioningState),
      },
      {
        name: 'tags',
        type: FieldType.string,
        values: relationships.map((relationship) =>
          relationship.properties?.tags ? JSON.stringify(relationship.properties.tags) : undefined
        ),
      },
    ],
  });
}
