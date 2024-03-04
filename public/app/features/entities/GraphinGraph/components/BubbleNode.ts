import G6, { IShape } from '@antv/g6';

import { getIconCodeByType } from '../../Icon.helper';
import { GraphCustomNode } from '../../asserts-types';

G6.registerNode('bubble-node', {
  draw(cfg, group) {
    const nodeModel = cfg as unknown as GraphCustomNode;
    const size = (nodeModel?.size || 0) as number;

    const keyshape = group?.addShape('circle', {
      attrs: {
        id: 'circle-container',
        x: 0,
        y: 0,
        r: size / 2,
        fill: nodeModel.style?.fill,
        lineWidth: nodeModel.style?.lineWidth || 1,
        opacity: nodeModel.style?.opacity || 1,
        stroke: nodeModel.style?.stroke,
      },
    });
    if (!keyshape) {
      return {} as IShape;
    }

    const iconCode = getIconCodeByType(nodeModel.entityType, nodeModel.properties);

    if (iconCode) {
      group?.addShape('text', {
        attrs: {
          id: 'node-icon',
          x: 0,
          y: nodeModel.label.length ? -size / 4 : 0,
          fontSize: nodeModel.label.length ? size / 4 : size * 0.7,
          fill: nodeModel.style?.iconColor || '#fff',
          text: String.fromCharCode(iconCode),
          fontFamily: 'icomoon',
          textAlign: 'center',
          textBaseline: 'middle',
          opacity: nodeModel.style?.opacity || 1,
        },
      });
    }

    if (nodeModel.label) {
      group?.addShape('text', {
        attrs: {
          id: 'text-desc',
          text: nodeModel.label,
          x: 0,
          y: 0,
          fontSize: nodeModel.labelCfg?.style?.fontSize,
          fill: nodeModel.assertion?.severity === 'warning' || !nodeModel.assertion?.severity ? '#000' : '#fff',
          textAlign: 'center',
          textBaseline: 'middle',
          opacity: nodeModel.style?.opacity || 1,
        },
      });
    }

    if (nodeModel.label && nodeModel.valueLabel) {
      group?.addShape('text', {
        attrs: {
          id: 'text-value',
          text: nodeModel.valueLabel,
          x: 0,
          y: nodeModel.label.length ? (nodeModel.labelCfg?.style?.fontSize || 10) + 4 : 0,
          fontSize: nodeModel.labelCfg?.style?.fontSize,
          fontWeight: 'bold',
          fill: nodeModel.assertion?.severity === 'warning' || !nodeModel.assertion?.severity ? '#000' : '#fff',
          textAlign: 'center',
          textBaseline: 'middle',
          opacity: nodeModel.style?.opacity || 1,
        },
      });
    }

    return keyshape;
    // return {
    //   shape: 'CustomNode',
    //   state: {
    //     selected: {
    //       'circle-assert-active-bg': {
    //         r: style.size + 12,
    //         lineWidth: 24,
    //       },
    //       'circle-assert-active-stroke': {
    //         r: style.size + 24,
    //         lineWidth: 1,
    //       },
    //     },
    //   },
    // };
  },
});
