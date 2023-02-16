import { LanguageDefinition } from '../monarch/register';

const cloudWatchSqlLanguageDefinition: LanguageDefinition = {
  id: 'cloudwatch-sql',
  extensions: ['.cloudwatchSql'],
  aliases: ['CloudWatch', 'cloudwatch', 'CloudWatchSQL'],
  mimetypes: [],
  loader: () => import('./language'),
};
export default cloudWatchSqlLanguageDefinition;
