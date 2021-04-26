import { default as GraphiteQueryModel } from '../graphite/graphite_query';
import { map } from 'lodash';
import { MetricNodeMatcher } from '../graphite/configuration/parseLokiLabelMappings';
import { LokiQuery } from './types';
import { GraphiteDatasource, GraphiteToLokiQueryImportConfiguration } from '../graphite/datasource';
import { getTemplateSrv } from '../../../features/templating/template_srv';
import { GraphiteQuery } from '../graphite/types';

const GRAPHITE_TO_LOKI_OPERATOR = {
  '=': '=',
  '!=': '!=',
  '=~': '=~',
  '!=~': '!~',
};

export default function importGraphiteQueries(
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
      expr: importGraphiteQuery(model, graphiteDataSource.getImportQueryConfiguration().loki),
    };
  });
}

function importGraphiteQuery(
  graphiteQuery: GraphiteQueryModel,
  config: GraphiteToLokiQueryImportConfiguration
): string {
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
    let mappings = config.mappings.filter((mapping) => mapping.matchers.length === targetNodes.length);

    for (let mapping of mappings) {
      const matchers = mapping.matchers.concat();

      matchingFound = matchers.every((matcher: MetricNodeMatcher, index: number) => {
        if (matcher.labelName) {
          let value = (targetNodes[index] as string)!;
          if (value === '*') {
            //
          } else if (value.includes('{')) {
            labels[matcher.labelName] = {
              value: value.replace(/\*/g, '.*').replace(/\{/g, '(').replace(/}/g, ')').replace(/,/g, '|'),
              operator: '=~',
            };
          } else {
            labels[matcher.labelName] = {
              value: value,
              operator: '=',
            };
          }
          return true;
        }
        return targetNodes[index] === matcher.value || matcher.value === '*';
      });
    }
  }

  if (matchingFound) {
    let pairs = map(labels, (value, key) => `${key}${value.operator}"${value.value}"`);
    if (pairs.length) {
      return `{${pairs.join(', ')}}`;
    } else {
      return '';
    }
  } else {
    return '';
  }
}
