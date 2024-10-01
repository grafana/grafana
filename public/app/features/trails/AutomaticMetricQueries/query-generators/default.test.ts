import { VAR_GROUP_BY_EXP } from '../../shared';
import { AutoQueryDef, AutoQueryInfo } from '../types';

import { getGeneralBaseQuery } from './common/baseQuery';
import { generateQueries } from './default';

describe('generateQueries', () => {
  const agg = 'sum';
  const unit = 'mockunit';

  type QueryInfoKey = keyof AutoQueryInfo;

  function testRateIndependentAssertions(queryDef: AutoQueryDef, key: QueryInfoKey) {
    describe('regardless of rate', () => {
      test(`specified unit must be propagated`, () => expect(queryDef.unit).toBe(unit));
      test(`only one query is expected`, () => expect(queryDef.queries.length).toBe(1));
      const query = queryDef.queries[0];
      test(`specified agg function must be propagated in the query expr`, () => {
        const queryAggFunction = query.expr.split('(', 2)[0];
        expect(queryAggFunction).toBe(agg);
      });
      if (key === 'breakdown') {
        const expectedSuffix = `by(${VAR_GROUP_BY_EXP})`;
        test(`breakdown query must end with "${expectedSuffix}"`, () => {
          const suffix = query.expr.substring(query.expr.length - expectedSuffix.length);
          expect(suffix).toBe(expectedSuffix);
        });
      }
    });
  }

  function testRateSpecificAssertions(queryDef: AutoQueryDef, rate: boolean, key: QueryInfoKey) {
    const query = queryDef.queries[0];
    const firstParen = query.expr.indexOf('(');
    const expectedBaseQuery = getGeneralBaseQuery(rate);
    const detectedBaseQuery = query.expr.substring(firstParen + 1, firstParen + 1 + expectedBaseQuery.length);

    const inParentheses = rate ? 'overall per-second rate' : 'overall';
    const description = `\${metric} (${inParentheses})`;

    describe(`since rate is ${rate}`, () => {
      test(`base query must be "${expectedBaseQuery}"`, () => expect(detectedBaseQuery).toBe(expectedBaseQuery));
      if (key === 'main') {
        test(`main panel title contains expected description "${description}"`, () =>
          expect(queryDef.title).toContain(description));
      } else {
        test(`${key} panel title is just "\${metric}"`, () => expect(queryDef.title).toBe('${metric}'));
        test(`${key} panel title does not contain description "${description}"`, () =>
          expect(queryDef.title).not.toContain(description));
      }

      if (key === 'breakdown') {
        test(`breakdown query uses "{{\${groupby}}}" as legend`, () =>
          expect(query.legendFormat).toBe('{{${groupby}}}'));
      } else {
        test(`preview query uses "${description}" as legend`, () => expect(query.legendFormat).toBe(description));
      }
    });
  }

  for (const rate of [true, false]) {
    describe(`when rate is ${rate}`, () => {
      const queryInfo = generateQueries({ agg, unit, rate });

      let key: QueryInfoKey;
      for (key in queryInfo) {
        if (key !== 'variants') {
          const queryDef = queryInfo[key];
          describe(`queryInfo.${key}`, () => testRateIndependentAssertions(queryDef, key));
          describe(`queryInfo.${key}`, () => testRateSpecificAssertions(queryDef, rate, key));
          continue;
        }

        queryInfo[key].forEach((queryDef, index) => {
          describe(`queryInfo.${key}[${index}]`, () => testRateIndependentAssertions(queryDef, key));
          describe(`queryInfo.${key}[${index}]`, () => testRateSpecificAssertions(queryDef, rate, key));
        });
      }
    });
  }
});
