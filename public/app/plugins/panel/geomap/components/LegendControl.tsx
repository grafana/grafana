import React from 'react';
import ReactDOM from 'react-dom';
import Control from 'ol/control/Control';
import { stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import tinycolor from 'tinycolor2';

export class LegendControl extends Control {
  styles = getStyles(config.theme);

  constructor() {
    super({
      element: document.createElement('div'),
    });

    this.element.className = this.styles.infoWrap;
    console.log('New legend control');
    this.doReactRender();
  }

  doReactRender = () => {
    if (!this.element) {
      return;
    }
    const map = this.getMap();
    if (!map) {
      console.log('no map????');
      return;
    }

    ReactDOM.render(<div>TODO... legend!</div>, this.element);
  };
}

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  infoWrap: css`
    position: absolute;
    left: 8px;
    bottom: 8px;
    color: ${theme.colors.text};
    background: ${tinycolor(theme.colors.panelBg).setAlpha(0.7).toString()};
    border-radius: 2px;
    padding: 8px;
  `,
}));
