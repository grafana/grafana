import { ExploreQueryParams } from 'app/types/explore';

import { v0Migrator } from './migrators/v0';
import { ExploreURLV1, v1Migrator } from './migrators/v1';

type ExploreURL = ExploreURLV1;

export const parseURL = (params: ExploreQueryParams) => {
  return migrate(params);
};

const migrators = [v0Migrator, v1Migrator] as const;

const migrate = (params: ExploreQueryParams): [ExploreURL, boolean] => {
  const schemaVersion = getSchemaVersion(params);

  const [parser, ...migratorsToRun] = migrators.slice(schemaVersion);

  const { error, to } = parser.parse(params);

  // @ts-expect-error
  const final: ExploreURL = migratorsToRun.reduce((acc, migrator) => {
    // @ts-expect-error
    return migrator.migrate ? migrator.migrate(acc) : acc;
  }, to);

  return [final, error];
};

function getSchemaVersion(params: ExploreQueryParams): number {
  if (!params || !('schemaVersion' in params) || !params.schemaVersion) {
    return 0;
  }

  if (typeof params.schemaVersion === 'number') {
    return params.schemaVersion;
  }

  if (typeof params.schemaVersion === 'string') {
    return Number.parseInt(params.schemaVersion, 10);
  }

  return 0;
}
