import { SceneQueryRunner } from '@grafana/scenes';

import { getPreviewPanelFor } from './previewPanel';

describe('getPreviewPanelFor', () => {
  describe('includes __ignore_usage__ indicator', () => {
    function callAndGetExpr(filterCount: number) {
      const result = getPreviewPanelFor('METRIC', 0, filterCount);
      const runner = result.state.$data as SceneQueryRunner;
      expect(runner).toBeInstanceOf(SceneQueryRunner);
      const query = runner.state.queries[0];
      const expr = query.expr as string;
      return expr;
    }

    test('When there are no filters, replace the ${filters} variable', () => {
      const expected = 'avg(${metric}{__ignore_usage__=""} ${otel_join_query})';
      const expr = callAndGetExpr(0);
      expect(expr).toStrictEqual(expected);
    });

    test('When there are 1 or more filters, append to the ${filters} variable', () => {
      const expected = 'avg(${metric}{__ignore_usage__="",${filters}} ${otel_join_query})';

      for (let i = 1; i < 10; ++i) {
        const expr = callAndGetExpr(1);
        expect(expr).toStrictEqual(expected);
      }
    });
  });
});
