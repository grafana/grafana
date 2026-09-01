import { defer, from, type Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  type DataFrame,
  type DataQueryRequest,
  type DataQueryResponse,
  type DataSourceInstanceSettings,
  FieldType,
  LoadingState,
  type ScopedVars,
  toDataFrame,
} from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv, type TemplateSrv } from '@grafana/runtime';

import { type AzureMonitorQuery } from '../types/query';
import { type AzureMonitorDataSourceJsonData } from '../types/types';
import { fetchAllArmPages, routeNames } from '../utils/common';

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

        return [
          healthModelFrame(target.refId, healthModel),
          entitiesFrame(target.refId, entities),
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

function entitiesFrame(refId: string, entities: HealthModelEntity[]): DataFrame {
  return toDataFrame({
    name: 'Entities',
    refId,
    fields: [
      { name: 'id', type: FieldType.string, values: entities.map((entity) => entity.id) },
      { name: 'name', type: FieldType.string, values: entities.map((entity) => entity.name) },
      {
        name: 'displayName',
        type: FieldType.string,
        values: entities.map((entity) => entity.properties?.displayName),
      },
      {
        name: 'healthState',
        type: FieldType.string,
        values: entities.map((entity) => entity.properties?.healthState),
      },
      {
        name: 'impact',
        type: FieldType.string,
        values: entities.map((entity) => entity.properties?.impact),
      },
      {
        name: 'healthObjective',
        type: FieldType.number,
        values: entities.map((entity) => entity.properties?.healthObjective ?? undefined),
      },
      {
        name: 'provisioningState',
        type: FieldType.string,
        values: entities.map((entity) => entity.properties?.provisioningState),
      },
      {
        name: 'tags',
        type: FieldType.string,
        values: entities.map((entity) =>
          entity.properties?.tags ? JSON.stringify(entity.properties.tags) : undefined
        ),
      },
    ],
  });
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
