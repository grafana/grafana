const cloudWatchSqlLanguageDefinition = {
    id: 'cloudwatch-sql',
    extensions: ['.cloudwatchSql'],
    aliases: ['CloudWatch', 'cloudwatch', 'CloudWatchSQL'],
    mimetypes: [],
    loader: () => import('./language'),
};
export default cloudWatchSqlLanguageDefinition;
//# sourceMappingURL=definition.js.map