import { v0Migrator } from './migrators/v0';
import { v1Migrator } from './migrators/v1';
export const parseURL = (params) => {
    return migrate(params);
};
const migrators = [v0Migrator, v1Migrator];
const migrate = (params) => {
    const schemaVersion = getSchemaVersion(params);
    const [parser, ...migratorsToRun] = migrators.slice(schemaVersion);
    const parsedUrl = parser.parse(params);
    // @ts-expect-error
    const final = migratorsToRun.reduce((acc, migrator) => {
        // @ts-expect-error
        return migrator.migrate ? migrator.migrate(acc) : acc;
    }, parsedUrl);
    return final;
};
function getSchemaVersion(params) {
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
//# sourceMappingURL=parseURL.js.map