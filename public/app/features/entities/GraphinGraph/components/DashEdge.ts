import G6 from '@antv/g6';

import { GraphCustomEdge } from '../../asserts-types';

G6.registerEdge(
  'DashEdge',
  {
    afterDraw(cfg, group) {
      const edgeModel = cfg as GraphCustomEdge;
      if (group) {
        const shape = group.get('children')[0];
        shape.attrs.stroke = edgeModel.style?.fill;
        shape.attrs.endArrow = true;
        shape.attrs.lineWidth = edgeModel.style?.width;
        shape.attrs.lineDash = [6, 4, 1, 4];

        const label = group.get('children')[1];
        label.attrs.fill = edgeModel.labelCfg?.style?.fill;
      }
    },
  },
  'line'
);
