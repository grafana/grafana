import { defer, from, type Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  type DataFrame,
  type DataQueryRequest,
  type DataQueryResponse,
  type DataSourceInstanceSettings,
  FieldType,
  LoadingState,
  MappingType,
  type ScopedVars,
  toDataFrame,
} from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv, type TemplateSrv } from '@grafana/runtime';
import { GraphDrawStyle, LineInterpolation, TableCellDisplayMode } from '@grafana/schema';

import { type AzureMonitorQuery } from '../types/query';
import { type AzureMonitorDataSourceJsonData } from '../types/types';
import { fetchAllArmPages, routeNames } from '../utils/common';

import { getEntityHealthMetrics } from './entityHealthMetrics';
import {
  type ArmListResponse,
  HEALTH_MODELS_API_VERSION,
  type HealthModel,
  type HealthModelEntity,
  type HealthModelEntityHistoryResponse,
  type HealthModelEntityHistoryTransition,
  type HealthModelRelationship,
  type HealthModelResourceId,
} from './types';

const ENTITY_HISTORY_PAGE_SIZE = 1000;
const ENTITY_HISTORY_CONCURRENCY = 10;

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
    const range = {
      from: options.range.from.toISOString(),
      to: options.range.to.toISOString(),
    };
    return defer(() => from(this.loadFrames(options.targets, range))).pipe(
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

  private async loadFrames(targets: AzureMonitorQuery[], range: HealthModelTimeRange): Promise<DataFrame[]> {
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

        if (target.azureHealthModels?.resultFormat === 'timeSeries') {
          const entities = await this.listCollection<HealthModelEntity>(`${healthModelId}/entities`, range.to);
          return this.loadEntityHistoryFrames(target.refId, healthModelId, entities, range);
        }

        const [healthModel, entities, relationships] = await Promise.all([
          this.getResource<HealthModel>(`${this.resourcePath}${healthModelId}`, {
            'api-version': HEALTH_MODELS_API_VERSION,
          }),
          this.listCollection<HealthModelEntity>(`${healthModelId}/entities`, range.to),
          this.listCollection<HealthModelRelationship>(`${healthModelId}/relationships`, range.to),
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

  private async loadEntityHistoryFrames(
    refId: string,
    healthModelId: string,
    entities: HealthModelEntity[],
    range: HealthModelTimeRange
  ): Promise<DataFrame[]> {
    const frames: DataFrame[] = [];

    for (let index = 0; index < entities.length; index += ENTITY_HISTORY_CONCURRENCY) {
      const entityBatch = entities.slice(index, index + ENTITY_HISTORY_CONCURRENCY);
      frames.push(
        ...(await Promise.all(
          entityBatch.map(async (entity) => {
            const history = await this.getEntityHistory(healthModelId, entity.name, range);
            return entityHistoryFrame(refId, entity, history, range);
          })
        ))
      );
    }

    return frames;
  }

  private async getEntityHistory(
    healthModelId: string,
    entityName: string,
    range: HealthModelTimeRange
  ): Promise<HealthModelEntityHistoryTransition[]> {
    const query = new URLSearchParams({ 'api-version': HEALTH_MODELS_API_VERSION });
    const path = `${this.resourcePath}${healthModelId}/entities/${encodeURIComponent(entityName)}/getHistory?${query.toString()}`;
    let response = await this.postResource<HealthModelEntityHistoryResponse>(path, {
      startAt: range.from,
      endAt: range.to,
      top: ENTITY_HISTORY_PAGE_SIZE,
    });
    const history = [...response.history];
    const seenMarkers = new Set<string>();

    while (response.nextMarker) {
      if (seenMarkers.has(response.nextMarker)) {
        throw new Error(`Entity history pagination returned the same marker more than once for "${entityName}".`);
      }
      seenMarkers.add(response.nextMarker);
      response = await this.postResource<HealthModelEntityHistoryResponse>(path, {
        nextMarker: response.nextMarker,
        top: ENTITY_HISTORY_PAGE_SIZE,
      });
      history.push(...response.history);
    }

    return history;
  }

  private listCollection<T>(collectionPath: string, timestamp: string): Promise<T[]> {
    const query = new URLSearchParams({
      'api-version': HEALTH_MODELS_API_VERSION,
      timestamp,
    });
    return fetchAllArmPages<T>(this.resourcePath, `${this.resourcePath}${collectionPath}?${query.toString()}`, (path) =>
      this.getResource<ArmListResponse<T>>(path)
    );
  }
}

interface HealthModelTimeRange {
  from: string;
  to: string;
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

function healthStateValue(healthState?: string): number {
  const index = HEALTH_STATES.indexOf(healthState ?? 'Unknown');
  return index === -1 ? HEALTH_STATES.indexOf('Unknown') : index;
}

function entityHistoryFrame(
  refId: string,
  entity: HealthModelEntity,
  history: HealthModelEntityHistoryTransition[],
  range: HealthModelTimeRange
): DataFrame {
  const rangeStart = Date.parse(range.from);
  const rangeEnd = Date.parse(range.to);
  const transitions = history
    .map((transition) => {
      const timestamp = Date.parse(transition.occurredAt);
      if (Number.isNaN(timestamp)) {
        throw new Error(`Entity history returned an invalid timestamp for "${entity.name}".`);
      }
      return { transition, timestamp };
    })
    .filter(({ timestamp }) => timestamp >= rangeStart && timestamp <= rangeEnd)
    .sort((left, right) => left.timestamp - right.timestamp);
  const firstState = transitions[0]?.transition.previousState ?? entity.properties?.healthState;
  const times = [rangeStart];
  const states = [healthStateValue(firstState)];

  for (const { transition, timestamp } of transitions) {
    const state = healthStateValue(transition.newState);
    if (times[times.length - 1] === timestamp) {
      states[states.length - 1] = state;
    } else {
      times.push(timestamp);
      states.push(state);
    }
  }

  const endState = healthStateValue(entity.properties?.healthState ?? transitions.at(-1)?.transition.newState);
  if (times[times.length - 1] === rangeEnd) {
    states[states.length - 1] = endState;
  } else {
    times.push(rangeEnd);
    states.push(endState);
  }

  const displayName = entity.properties?.displayName;
  const seriesName = displayName && displayName !== entity.name ? `${displayName} (${entity.name})` : entity.name;

  return toDataFrame({
    name: entity.name,
    refId,
    meta: {
      preferredVisualisationType: 'graph',
    },
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        values: times,
      },
      {
        name: 'healthState',
        type: FieldType.enum,
        values: states,
        labels: { entityName: entity.name },
        config: {
          displayName: seriesName,
          custom: {
            drawStyle: GraphDrawStyle.Line,
            lineInterpolation: LineInterpolation.StepAfter,
          },
          type: { enum: { text: HEALTH_STATES, color: HEALTH_STATE_TEXT_COLORS } },
        },
      },
    ],
  });
}

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
        values: entities.map((entity) => healthStateValue(entity.properties?.healthState)),
        config: {
          displayName: 'Health state',
          custom: { hidden: true },
          type: { enum: { text: HEALTH_STATES, color: HEALTH_STATE_TEXT_COLORS } },
        },
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
          const healthy = metric.signals.filter((signal) => signal.healthState?.toLowerCase() === 'healthy').length;
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
