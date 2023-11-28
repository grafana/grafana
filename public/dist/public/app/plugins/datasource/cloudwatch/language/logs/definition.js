export const CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID = 'cloudwatch-logs';
const cloudWatchLogsLanguageDefinition = {
    id: CLOUDWATCH_LOGS_LANGUAGE_DEFINITION_ID,
    extensions: [],
    aliases: [],
    mimetypes: [],
    loader: () => import('./language'),
};
export default cloudWatchLogsLanguageDefinition;
//# sourceMappingURL=definition.js.map