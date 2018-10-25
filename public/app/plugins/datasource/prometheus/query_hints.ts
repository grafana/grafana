import _ from 'lodash';

export function getQueryHints(query: string, series?: any[], datasource?: any): any[] {
  const hints = [];

  // ..._bucket metric needs a histogram_quantile()
  const histogramMetric = query.trim().match(/^\w+_bucket$/);
  if (histogramMetric) {
    const label = 'Time series has buckets, you probably wanted a histogram.';
    hints.push({
      type: 'HISTOGRAM_QUANTILE',
      label,
      fix: {
        label: 'Fix by adding histogram_quantile().',
        action: {
          type: 'ADD_HISTOGRAM_QUANTILE',
          query,
        },
      },
    });
  }

  // Check for monotony on series (table results are being ignored here)
  if (series && series.length > 0) {
    series.forEach(s => {
      const datapoints: number[][] = s.datapoints;
      if (query.indexOf('rate(') === -1 && datapoints.length > 1) {
        let increasing = false;
        const nonNullData = datapoints.filter(dp => dp[0] !== null);
        const monotonic = nonNullData.every((dp, index) => {
          if (index === 0) {
            return true;
          }
          increasing = increasing || dp[0] > nonNullData[index - 1][0];
          // monotonic?
          return dp[0] >= nonNullData[index - 1][0];
        });
        if (increasing && monotonic) {
          const simpleMetric = query.trim().match(/^\w+$/);
          let label = 'Time series is monotonously increasing.';
          let fix;
          if (simpleMetric) {
            fix = {
              label: 'Fix by adding rate().',
              action: {
                type: 'ADD_RATE',
                query,
              },
            };
          } else {
            label = `${label} Try applying a rate() function.`;
          }
          hints.push({
            type: 'APPLY_RATE',
            label,
            fix,
          });
        }
      }
    });
  }

  // Check for recording rules expansion
  if (datasource && datasource.ruleMappings) {
    const mapping = datasource.ruleMappings;
    const mappingForQuery = Object.keys(mapping).reduce((acc, ruleName) => {
      if (query.search(ruleName) > -1) {
        return {
          ...acc,
          [ruleName]: mapping[ruleName],
        };
      }
      return acc;
    }, {});
    if (_.size(mappingForQuery) > 0) {
      const label = 'Query contains recording rules.';
      hints.push({
        type: 'EXPAND_RULES',
        label,
        fix: {
          label: 'Expand rules',
          action: {
            type: 'EXPAND_RULES',
            query,
            mapping: mappingForQuery,
          },
        },
      });
    }
  }
  return hints.length > 0 ? hints : null;
}
