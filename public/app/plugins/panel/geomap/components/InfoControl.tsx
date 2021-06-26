import React from 'react';
import ReactDOM from 'react-dom';
import { PluggableMap } from 'ol';
import Control from 'ol/control/Control';
import { transform } from 'ol/proj';
import { stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';

export class InfoControl extends Control {
  styles = getStyles(config.theme);

  constructor() {
    super({
      element: document.createElement('div'),
    });

    this.element.className = 'ol-control ' + this.styles.infoWrap;
    console.log('New INFO control');
  }

  setMap(map: PluggableMap) {
    // Cleanup old listeners
    if (!map) {
      const t = this.getMap();
      if (t) {
        t.un('moveend', this.doReactRender);
      }
    }

    super.setMap(map);
    if (map) {
      map.on('moveend', this.doReactRender);
      this.doReactRender();
    }
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

    var view = map.getView();
    const zoom = view.getZoom();
    const center = transform(view.getCenter()!, view.getProjection(), 'EPSG:4326');

    ReactDOM.render(
      <div>
        Zoom: {zoom?.toFixed(1)} CENTER: {center[0].toFixed(5)}, {center[1].toFixed(5)}
      </div>,
      this.element
    );
  };
}

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  infoWrap: css`
    top: 4px;
    right: 4px;
    border: 1px solid green;
    color: black;
  `,
}));
