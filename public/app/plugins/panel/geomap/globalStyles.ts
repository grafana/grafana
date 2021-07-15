import { css } from '@emotion/react';
import { GrafanaTheme2 } from '@grafana/data';

import 'ol/ol.css';
import tinycolor from 'tinycolor2';

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

  const bg = tinycolor(theme.v1.colors.panelBg);
  const button = tinycolor(theme.colors.secondary.main);
  return css`
    .ol-scale-line {
      background: ${bg.setAlpha(0.7).toRgbString()}; // rgba(0,60,136,0.3);
    }
    .ol-scale-line-inner {
      border: 1px solid ${theme.colors.text.primary}; // #eee;
      border-top: 0px;
      color: ${theme.colors.text.primary}; //  #eee;
    }
    .ol-control {
      background-color: ${bg.setAlpha(0.4).toRgbString()}; //rgba(255,255,255,0.4);
    }
    .ol-control:hover {
      background-color: ${bg.setAlpha(0.6).toRgbString()}; // rgba(255,255,255,0.6);
    }
    .ol-control button {
      color: ${bg.setAlpha(0.8).toRgbString()}; // white;
      background-color: ${button.setAlpha(0.5).toRgbString()}; // rgba(0,60,136,0.5);
    }
    .ol-control button:hover {
      background-color: ${button.setAlpha(0.7).toRgbString()}; // rgba(0,60,136,0.7);
    }
    .ol-control button:focus {
      // same as button
      background-color: ${button.setAlpha(0.5).toRgbString()}; // rgba(0,60,136,0.5);
    }
    .ol-attribution ul {
      color: ${theme.colors.text.primary}; //  #000;
      text-shadow: 0 0 0px #fff; // removes internal styling!
    }
    .ol-attribution:not(.ol-collapsed) {
      background-color: ${bg.setAlpha(0.8).toRgbString()}; // rgba(255,255,255,0.8);
    }
  `;
}
