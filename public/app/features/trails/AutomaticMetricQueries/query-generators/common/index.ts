import { generateQueries } from './queries';
import { getGeneratorParameters } from './rules';

function generator(metricParts: string[]) {
  const params = getGeneratorParameters(metricParts);
  return generateQueries(params);
}

export default { generator };
