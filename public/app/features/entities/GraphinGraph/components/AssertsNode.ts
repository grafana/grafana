import G6, { IShape, Item } from '@antv/g6';
import { unionBy } from 'lodash';

import { getIconCodeByType } from '../../Icon.helper';
import { GraphCustomNode, EntityAssertion } from '../../asserts-types';
import { assertsColors } from '../../constants';

export const DISABLED_NODE_OPACITY = 0.2;
const CARD_WIDTH = 250;
const CARD_ICON_SIZE = 16;
const CARD_LINE_DISTANCE = 11;
const CARD_FONT_LINE_HEIGHT = 11;
const CARD_FONT_SIZE = 12;

export const getStrokeColor = (assertion: EntityAssertion | undefined, omitColor?: boolean): string => {
  if (omitColor) {
    return '#e3e3e3';
  }
  if (assertion?.severity === 'critical') {
    return assertsColors.critical;
  }
  if (assertion?.severity === 'warning') {
    return assertsColors.warning;
  }
  if (assertion?.severity === 'info') {
    return assertsColors.info;
  }
  return '#e3e3e3';
};

const getStrokeWidth = (node: GraphCustomNode, level: 1 | 2): number => {
  if ((node.assertion && level === 2) || (node.connectedAssertion && level === 1)) {
    return 2;
  }

  if ((node.assertion && level === 1) || (node.connectedAssertion && level === 2)) {
    return 1;
  }

  return 0;
};

const fittingString = (str: string, maxWidth: number, fontSize: number) => {
  const ellipsis = '...';
  const ellipsisLength = G6.Util.getTextSize(ellipsis, fontSize)[0];
  let currentWidth = 0;
  let res = str;
  str.split('').forEach((letter, i) => {
    if (currentWidth > maxWidth - ellipsisLength) {
      return;
    }

    // get the width of single letter according to the fontSize
    currentWidth += G6.Util.getLetterWidth(letter, fontSize);
    if (currentWidth > maxWidth - ellipsisLength) {
      res = `${str.substr(0, i)}${ellipsis}`;
    }
  });
  return res;
};

const defaultStyles = {
  size: 30,
  fill: '#cadef2',
  fontSize: 14,
  fontColor: '#666666',
  strokeFirstLevelColor: '#ff5151',
  strokeSecondLevelColor: '#f2c222',
  strokeSecondLevelWidth: 2,
  strokeFirstLevelWidth: 2,
};

G6.registerNode('asserts-node', {
  /*    getCustomConfig: (cfg: ModelConfig) => {
      const nodeModel = (cfg as unknown) as GraphCustomNode;
      const style = {
        ...defaultStyles,
        ...nodeModel.style,
      };

      // it will work only if for registerNode extend with 3 param for example 'single-node' see here https://github.com/antvis/G6/issues/3002
      cfg.stateStyles = {
        selected: {
          'circle-active-assert-highlight': {
            r: style.size + 24,
            lineWidth: 1,
          },
        },
      };
      return cfg;
    },*/
  setState: (name?: string, value?: string | boolean, item?: Item) => {
    const activeItem = item
      ?.getContainer()
      .getChildren()
      .find((child) => child.attr('id') === 'circle-active-assert-highlight');

    if (activeItem && item?.hasState('selected')) {
      activeItem.attr('r', activeItem.cfg.attrs.r + 24);
      activeItem.attr('lineWidth', 1);
    } else if (activeItem) {
      activeItem.attr('r', activeItem.cfg.attrs.r);
      activeItem.attr('lineWidth', activeItem.cfg.attrs.lineWidth);
    }
  },
  draw(cfg, group) {
    const nodeModel = cfg as unknown as GraphCustomNode;
    const padding = [20, 25, 25, 20];

    let cardHeight = padding[0] + padding[2];

    const isForSummary = Boolean(nodeModel.summaryMetrics);

    const severityForSummary =
      nodeModel.summaryMetrics?.find((metric) => metric.healthStates?.[0]?.severity === 'critical')?.healthStates[0]
        .severity ||
      nodeModel.summaryMetrics?.find((metric) => metric.healthStates?.[0]?.severity === 'warning')?.healthStates[0]
        .severity ||
      nodeModel.summaryMetrics?.find((metric) => metric.healthStates?.[0]?.severity === 'info')?.healthStates[0]
        .severity;

    const infoForSummary = nodeModel.summaryMetrics?.find((metric) => metric.healthStates?.[0]?.severity === 'info')
      ?.healthStates[0].severity;

    // calculating height of card
    if (nodeModel.summaryMetrics?.length) {
      cardHeight += (CARD_LINE_DISTANCE + CARD_FONT_LINE_HEIGHT) * nodeModel.summaryMetrics.length;
    }

    const style = {
      ...defaultStyles,
      ...nodeModel.style,
    };

    // decrease size of circle node if it's summary metrics mode
    if (isForSummary) {
      style.size = 15;
    }

    const opacity = style.opacity ? style.opacity : nodeModel.disabled ? DISABLED_NODE_OPACITY : 1;

    nodeModel.size = defaultStyles.size + 10; // 10 is 8 distance and 2 of outer circle

    const circleOrigin = { x: 0, y: 0 };

    group?.addShape('circle', {
      attrs: {
        id: 'circle-active-assert-highlight',
        ...circleOrigin,
        r: style.size as number,
        // fill: hex2rgba('#1c75d1', 0.2),
        lineWidth: 0,
        stroke: '#1c75d1',
        opacity,
        cursor: style.cursor,
      },
      name: 'circle-active-assert-highlight',
      draggable: true,
    });

    const infoColor = assertsColors.info;
    const level2color = getStrokeColor(isForSummary ? { severity: severityForSummary } : nodeModel.assertion);
    let isAmend = infoColor !== level2color && nodeModel.assertion?.amend;

    let gradient2Level = `l(0)  0:${level2color} ${
      isAmend
        ? `0.48:${level2color}  0.48:rgba(0,0,0,0)  0.52:rgba(0,0,0,0)  0.52:${infoColor}  1:${infoColor} `
        : `1:${level2color} `
    }`;

    if (isAmend && !infoForSummary && isForSummary) {
      gradient2Level = `l(0)  0:${level2color} 1:${level2color} `;
    }

    let keyShape = group?.addShape('circle', {
      attrs: {
        ...circleOrigin,
        id: 'circle-assert-level-2',
        r: style.size + 8,
        fill: 'transparent',
        lineWidth: getStrokeWidth(nodeModel, 2),
        stroke: gradient2Level,
        opacity,
        cursor: style.cursor,
      },
      name: 'circle-assert-level-2',
      draggable: true,
    });

    const level1color = getStrokeColor(nodeModel.connectedAssertion, isForSummary);
    isAmend = infoColor !== level1color && nodeModel.connectedAssertion?.amend;
    const gradient1Level = `l(0)  0:${level1color} ${
      isAmend
        ? `0.48:${level1color}  0.48:rgba(0,0,0,0)  0.52:rgba(0,0,0,0)  0.52:${infoColor}  1:${infoColor} `
        : `1:${level1color} `
    }`;
    group?.addShape('circle', {
      attrs: {
        id: 'circle-assert-level-1',
        ...circleOrigin,
        r: style.size + 4,
        fill: 'transparent',
        lineWidth: getStrokeWidth(nodeModel, 1),
        stroke: gradient1Level,
        opacity,
        cursor: style.cursor,
      },
      name: 'circle-assert-level-1',
      draggable: true,
    });

    group?.addShape('circle', {
      attrs: {
        id: 'circle-container',
        ...circleOrigin,
        r: style.size,
        fill: style.fill,
        lineWidth: 0,
        opacity,
        cursor: style.cursor,
      },
      name: 'circle-container',
      draggable: true,
    });

    const iconCode = getIconCodeByType(nodeModel.entityType, nodeModel.properties);

    if (iconCode) {
      group?.addShape('text', {
        attrs: {
          id: 'node-icon',
          ...circleOrigin,
          fontSize: style.size as number,
          fill: '#fff',
          cursor: style.cursor,
          text: String.fromCharCode(iconCode),
          fontFamily: 'icomoon',
          textAlign: 'center',
          textBaseline: 'middle',
        },
        name: 'node-icon',
        draggable: true,
      });
    }

    const cardOrigin = {
      x: circleOrigin.x + style.size / 2 + 15,
      y: -cardHeight / 2 + 7,
    };

    if (isForSummary && group) {
      group?.addShape('text', {
        attrs: {
          id: 'text-desc',
          text: nodeModel.showLabels
            ? fittingString(nodeModel.label, CARD_WIDTH - padding[1] - CARD_ICON_SIZE - 20, CARD_FONT_SIZE)
            : '',
          ...cardOrigin,
          y: cardOrigin.y + 10,
          fontSize: style.fontSize,
          fontWeight: 'bold',
          fill: style.fontColor,
          cursor: style.cursor,
        },
        name: 'text-desc',
        draggable: true,
      });
    } else {
      group?.addShape('text', {
        attrs: {
          id: 'text-desc',
          text: nodeModel.showLabels ? fittingString(nodeModel.label, style.size * 2 + 10, style.fontSize) : '',
          ...circleOrigin,
          y: circleOrigin.y + style.size * 1.3,
          fontSize: style.fontSize,
          fill: style.fontColor,
          textAlign: 'center',
          textBaseline: 'top',
          opacity,
          cursor: style.cursor,
        },
        name: 'text-desc',
        draggable: true,
      });
    }

    if (nodeModel.summaryMetrics?.length && group) {
      group.addShape('rect', {
        name: 'card-rect',
        attrs: {
          ...cardOrigin,
          width: CARD_WIDTH,
          height: cardHeight,
        },
        draggable: true,
      });

      let currentLineY = cardOrigin.y + padding[0];

      let summaryToRender = unionBy(nodeModel.summaryMetrics, [], 'alertName');

      // check nested summaries as well
      nodeModel.summaryMetrics.forEach((item) => {
        summaryToRender = unionBy(summaryToRender, item.nestedSummaries, 'alertName');
      });

      summaryToRender.forEach((summary) => {
        const iconCode = getIconCodeByType(summary.alertName) || getIconCodeByType(summary.category);

        if (iconCode) {
          group?.addShape('text', {
            attrs: {
              id: 'node-icon',
              x: padding[3] + cardOrigin.x,
              y: currentLineY,
              fontSize: CARD_ICON_SIZE,
              fill: '#1c75d1',
              text: String.fromCharCode(iconCode),
              fontFamily: 'icomoon',
              textAlign: 'center',
              textBaseline: 'top',
            },
            draggable: true,
          });
        }

        group?.addShape('text', {
          attrs: {
            x: cardOrigin.x + padding[3] + CARD_ICON_SIZE, // 10 is distance between line and text
            y: currentLineY + 2,
            text: summary.alertName,
            fill: style.fontColor,
            textBaseline: 'top',
            fontSize: CARD_FONT_SIZE,
          },
          draggable: true,
        });
        currentLineY += CARD_LINE_DISTANCE + CARD_FONT_LINE_HEIGHT;
      });
    }
    // leaving it here for debugging
    // group?.addShape('text', {
    //   attrs: {
    //     text: nodeModel.id,
    //     x: 0,
    //     y: 0,
    //     fontSize: 20,
    //     fill: 'red',
    //     textAlign: 'center',
    //     textBaseline: 'top',
    //   },
    //   draggable: true,
    // });

    return keyShape as IShape;
  },
});
