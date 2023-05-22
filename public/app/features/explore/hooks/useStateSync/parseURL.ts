import { v0Migrator } from './migrators/v0';
import { ExploreURLV1, v1Migrator } from './migrators/v1';

export const parseURL = (params: AnyExploreParams) => {
  return migrate(params);
};

interface AnyExploreParams {
  [key: string]: string | undefined;
}

const migrators = [v0Migrator, v1Migrator] as const;

const migrate = (params: AnyExploreParams): ExploreURL => {
  const schemaVersion = params && 'schemaVersion' in params ? Number.parseInt(params.schemaVersion || '0', 10) : 0;

  const [parser, ...migratorsToRun] = migrators.slice(schemaVersion);

  const parsedUrl = parser.parse(params);

  // @ts-expect-error
  const final: ExploreURL = migratorsToRun.reduce((acc, migrator) => {
    // @ts-expect-error
    return migrator.migrate ? migrator.migrate(acc) : acc;
  }, parsedUrl);

  return final;
};

type ExploreURL = ExploreURLV1;
