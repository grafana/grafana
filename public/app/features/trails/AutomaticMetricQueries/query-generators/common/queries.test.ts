import { VAR_GROUP_BY_EXP } from '../../../shared';
import { AutoQueryDef, AutoQueryInfo } from '../../types';

import { generateQueries, getGeneralBaseQuery } from './queries';

describe('generateQueries', () => {
  const agg = 'mockagg';
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

  function testRateSpecificAssertions(queryDef: AutoQueryDef, rate: boolean) {
    const query = queryDef.queries[0];
    const firstParen = query.expr.indexOf('(');
    const expectedBaseQuery = getGeneralBaseQuery(rate);
    const detectedBaseQuery = query.expr.substring(firstParen + 1, firstParen + 1 + expectedBaseQuery.length);

    describe(`since rate is ${rate}`, () => {
      test(`base query must be "${expectedBaseQuery}"`, () => expect(detectedBaseQuery).toBe(expectedBaseQuery));
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
          describe(`queryInfo.${key}`, () => testRateSpecificAssertions(queryDef, rate));
          continue;
        }

        queryInfo[key].forEach((queryDef, index) => {
          describe(`queryInfo.${key}[${index}]`, () => testRateIndependentAssertions(queryDef, key));
          describe(`queryInfo.${key}[${index}]`, () => testRateSpecificAssertions(queryDef, rate));
        });
      }
    });
  }
});
