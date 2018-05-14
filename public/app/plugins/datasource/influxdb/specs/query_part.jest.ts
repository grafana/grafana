import queryPart from '../query_part';
import { registerAngularDirectives } from '../../../../core/core';

describe('InfluxQueryPart', () => {
  describe('series with measurement only', () => {
    it('should handle nested function parts', () => {
      var part = queryPart.create({
        type: 'derivative',
        params: ['10s'],
      });

      expect(part.text).toBe('derivative(10s)');
      expect(part.render('mean(value)')).toBe('derivative(mean(value), 10s)');
    });

    it('should nest spread function', () => {
      var part = queryPart.create({
        type: 'spread',
      });

      expect(part.text).toBe('spread()');
      expect(part.render('value')).toBe('spread(value)');
    });

    it('should handle suffix parts', () => {
      var part = queryPart.create({
        type: 'math',
        params: ['/ 100'],
      });

      expect(part.text).toBe('math(/ 100)');
      expect(part.render('mean(value)')).toBe('mean(value) / 100');
    });

    it('should handle alias parts', () => {
      var part = queryPart.create({
        type: 'alias',
        params: ['test'],
      });

      expect(part.text).toBe('alias(test)');
      expect(part.render('mean(value)')).toBe('mean(value) AS "test"');
    });

    it('should nest distinct when count is selected', () => {
      var selectParts = [
        queryPart.create({
          type: 'field',
          category: queryPart.getCategories().Fields,
        }),
        queryPart.create({
          type: 'count',
          category: queryPart.getCategories().Aggregations,
        })
      ];
      var partModel = queryPart.create({
        type: 'distinct',
      });

      queryPart.replaceAggregationAdd(selectParts, partModel);

      expect(selectParts[1].text).toBe("distinct()");
      expect(selectParts[2].text).toBe("count()");
    });

    it('should replace count distinct if an aggregation is selected', () => {
      var selectParts = [
        queryPart.create({
          type: 'field',
          category: queryPart.getCategories().Fields,
        }),
        queryPart.create({
          type: 'distinct',
          category: queryPart.getCategories().Aggregations,
        }),
        queryPart.create({
          type: 'count',
          category: queryPart.getCategories().Aggregations,
        })
      ];
      var partModel = queryPart.create({
        type: 'mean',
      });

      queryPart.replaceAggregationAdd(selectParts, partModel);

      expect(selectParts[1].text).toBe("mean()");
      expect(selectParts).toHaveLength(2);
    });
  });
});
