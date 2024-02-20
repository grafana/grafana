export type Query = {
  dataSourceUid: string;
  query: string;
};

export type EntityDef = {
  requiredKeys: string[];
  optionalKeys?: string[];
  queries: Query[];
};

class EntityService {
  constructor(private entityDefs: EntityDef[]) {}

  getEntitiesForKeys(keys: string[]) {
    return this.entityDefs.filter((ed) => {
      return ed.requiredKeys.every((rk) => keys.includes(rk));
    });
  }
}

export const entityService = new EntityService([
  {
    requiredKeys: ['service.name'],
    queries: [
      {
        dataSourceUid: 'tempo-service-graph',
        query: '{ service.name="$__service_name" }',
      },
      {
        dataSourceUid: 'prometheus',
        query: 'traces_service_graph_request_total{ server="$__service_name" }',
      },
      {
        dataSourceUid: 'tempo',
        query: '{ service.name="$__service_name" }',
      },
      {
        dataSourceUid: 'loki',
        query: '{ service.name="$__service_name" }',
      },
    ],
  },
]);
