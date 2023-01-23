import { LanguageDefinition } from '../monarch/register';

const cloudWatchMetricMathLanguageDefinition: LanguageDefinition = {
  id: 'cloudwatch-MetricMath',
  extensions: [],
  aliases: [],
  mimetypes: [],
  loader: () => import('./language'),
};
export default cloudWatchMetricMathLanguageDefinition;
