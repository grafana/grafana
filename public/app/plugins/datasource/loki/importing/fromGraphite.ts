import { default as GraphiteQueryModel } from '../../graphite/graphite_query';
import { map } from 'lodash';
import { LokiQuery } from '../types';
import { GraphiteDatasource } from '../../graphite/datasource';
import { getTemplateSrv } from '../../../../features/templating/template_srv';
import { GraphiteMetricLokiMatcher, GraphiteQuery, GraphiteToLokiQueryImportConfiguration } from '../../graphite/types';

const GRAPHITE_TO_LOKI_OPERATOR = {
  '=': '=',
  '!=': '!=',
  '=~': '=~',
  '!=~': '!~',
};

/**
 * Converts Graphite glob-like pattern to a regular expression
 */
function convertGlobToRegEx(text: string): string {
  if (text.includes('*') || text.includes('{')) {
    return '^' + text.replace(/\*/g, '.*').replace(/\{/g, '(').replace(/}/g, ')').replace(/,/g, '|');
  } else {
    return text;
  }
}

export default function fromGraphiteQueries(
  graphiteQueries: GraphiteQuery[],
  graphiteDataSource: GraphiteDatasource
): LokiQuery[] {
  return graphiteQueries.map((query) => {
    const model: GraphiteQueryModel = new GraphiteQueryModel(
      graphiteDataSource,
      {
        ...query,
        target: query.target || '',
        textEditor: false,
      },
      getTemplateSrv()
    );
    model.parseTarget();

    return {
      refId: query.refId,
      expr: fromGraphite(model, graphiteDataSource.getImportQueryConfiguration().loki),
    };
  });
}

function fromGraphite(graphiteQuery: GraphiteQueryModel, config: GraphiteToLokiQueryImportConfiguration): string {
  let matchingFound = false;
  let labels: any = {};

  if (graphiteQuery.seriesByTagUsed) {
    matchingFound = true;
    graphiteQuery.tags.forEach((tag) => {
      labels[tag.key] = {
        value: tag.value,
        operator: GRAPHITE_TO_LOKI_OPERATOR[tag.operator],
      };
    });
  } else {
    const targetNodes = graphiteQuery.segments.map((segment) => segment.value);
    let mappings = config.mappings.filter((mapping) => mapping.matchers.length <= targetNodes.length);

    for (let mapping of mappings) {
      const matchers = mapping.matchers.concat();

      matchingFound = matchers.every((matcher: GraphiteMetricLokiMatcher, index: number) => {
        if (matcher.labelName) {
          let value = (targetNodes[index] as string)!;

          if (value === '*') {
            return true;
          }

          const converted = convertGlobToRegEx(value);
          labels[matcher.labelName] = {
            value: converted,
            operator: converted !== value ? '=~' : '=',
          };

          return true;
        }
        return targetNodes[index] === matcher.value || matcher.value === '*';
      });
    }
  }

  let pairs = map(labels, (value, key) => `${key}${value.operator}"${value.value}"`);
  if (matchingFound && pairs.length) {
    return `{${pairs.join(', ')}}`;
  } else {
    return '';
  }
}
