import { css } from '@emotion/react';
import { Circle as CircleStyle, Fill, RegularShape, Stroke, Style, Text } from 'ol/style';

import { GrafanaTheme2 } from '@grafana/data';

import 'ol/ol.css';
import 'ol-ext/dist/ol-ext.css';

/**
 * Will be loaded *after* the css above
 */
export function getGlobalStyles(theme: GrafanaTheme2) {
  // NOTE: this works with
  //  node_modules/ol/ol.css
  // use !important;
  // This file keeps the rules

  // .ol-box {
  //   border: 2px solid blue;
  // }

  // .ol-scale-step-marker {
  //   background-color: #000000;
  // }
  // .ol-scale-step-text {
  //   color: #000000;
  //   text-shadow: -2px 0 #FFFFFF, 0 2px #FFFFFF, 2px 0 #FFFFFF, 0 -2px #FFFFFF;
  // }
  // .ol-scale-text {
  //   color: #000000;
  //   text-shadow: -2px 0 #FFFFFF, 0 2px #FFFFFF, 2px 0 #FFFFFF, 0 -2px #FFFFFF;
  // }
  // .ol-scale-singlebar {
  //   border: 1px solid black;
  // }
  // .ol-viewport, .ol-unselectable {
  //   -webkit-tap-highlight-color: rgba(0,0,0,0);
  // }

  // .ol-overviewmap .ol-overviewmap-map {
  //   border: 1px solid #7b98bc;
  // }
  // .ol-overviewmap:not(.ol-collapsed) {
  //   background: rgba(255,255,255,0.8);
  // }
  // .ol-overviewmap-box {
  //   border: 2px dotted rgba(0,60,136,0.7);
  // }

  return css`
    .ol-scale-line {
      background: ${theme.colors.border.weak}; // rgba(0,60,136,0.3);
    }
    .ol-scale-line-inner {
      border: 1px solid ${theme.colors.text.primary}; // #eee;
      border-top: 0px;
      color: ${theme.colors.text.primary}; //  #eee;
    }
    .ol-control {
      background-color: ${theme.colors.background.secondary}; //rgba(255,255,255,0.4);
    }
    .ol-control:hover {
      background-color: ${theme.colors.action.hover}; // rgba(255,255,255,0.6);
    }
    .ol-control button {
      color: ${theme.colors.secondary.text}; // white;
      background-color: ${theme.colors.secondary.main}; // rgba(0,60,136,0.5);
    }
    .ol-control button:hover {
      background-color: ${theme.colors.secondary.shade}; // rgba(0,60,136,0.5);
    }
    .ol-control button:focus {
      background-color: ${theme.colors.secondary.main}; // rgba(0,60,136,0.5);
    }
    .ol-attribution ul {
      color: ${theme.colors.text.primary}; //  #000;
      text-shadow: none;
    }
    .ol-attribution:not(.ol-collapsed) {
      background-color: ${theme.colors.background.secondary}; // rgba(255,255,255,0.8);
    }
  `;
}

// Open Layer styles
export const style = new Style({
  fill: new Fill({
    color: 'rgba(255, 255, 255, 0.2)',
  }),
  stroke: new Stroke({
    color: 'rgba(0, 0, 0, 0.5)',
    lineDash: [10, 10],
    width: 2,
  }),
  image: new CircleStyle({
    radius: 5,
    stroke: new Stroke({
      color: 'rgba(0, 0, 0, 0.7)',
    }),
    fill: new Fill({
      color: 'rgba(255, 255, 255, 0.2)',
    }),
  }),
});

export const labelStyle = new Style({
  text: new Text({
    font: '14px Calibri,sans-serif',
    fill: new Fill({
      color: 'rgba(255, 255, 255, 1)',
    }),
    backgroundFill: new Fill({
      color: 'rgba(0, 0, 0, 0.7)',
    }),
    padding: [3, 3, 3, 3],
    textBaseline: 'bottom',
    offsetY: -15,
  }),
  image: new RegularShape({
    radius: 8,
    points: 3,
    angle: Math.PI,
    displacement: [0, 10],
    fill: new Fill({
      color: 'rgba(0, 0, 0, 0.7)',
    }),
  }),
});

export const tipStyle = new Style({
  text: new Text({
    font: '12px Calibri,sans-serif',
    fill: new Fill({
      color: 'rgba(255, 255, 255, 1)',
    }),
    backgroundFill: new Fill({
      color: 'rgba(0, 0, 0, 0.4)',
    }),
    padding: [2, 2, 2, 2],
    textAlign: 'left',
    offsetX: 15,
  }),
});

export const modifyStyle = new Style({
  image: new CircleStyle({
    radius: 5,
    stroke: new Stroke({
      color: 'rgba(0, 0, 0, 0.7)',
    }),
    fill: new Fill({
      color: 'rgba(0, 0, 0, 0.4)',
    }),
  }),
  text: new Text({
    text: 'Drag to modify',
    font: '12px Calibri,sans-serif',
    fill: new Fill({
      color: 'rgba(255, 255, 255, 1)',
    }),
    backgroundFill: new Fill({
      color: 'rgba(0, 0, 0, 0.7)',
    }),
    padding: [2, 2, 2, 2],
    textAlign: 'left',
    offsetX: 15,
  }),
});

export const segmentStyle = new Style({
  text: new Text({
    font: '12px Calibri,sans-serif',
    fill: new Fill({
      color: 'rgba(255, 255, 255, 1)',
    }),
    backgroundFill: new Fill({
      color: 'rgba(0, 0, 0, 0.4)',
    }),
    padding: [2, 2, 2, 2],
    textBaseline: 'bottom',
    offsetY: -12,
  }),
  image: new RegularShape({
    radius: 6,
    points: 3,
    angle: Math.PI,
    displacement: [0, 8],
    fill: new Fill({
      color: 'rgba(0, 0, 0, 0.4)',
    }),
  }),
});
