import React from 'react';
import ReactDOM from 'react-dom';
import { PluggableMap } from 'ol';
import Control from 'ol/control/Control';
import { transform } from 'ol/proj';
import { stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import tinycolor from 'tinycolor2';

export class InfoControl extends Control {
  styles = getStyles(config.theme);

  constructor() {
    super({
      element: document.createElement('div'),
    });

    this.element.className = this.styles.infoWrap;
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
        <table>
          <tbody>
            <tr>
              <th>Zoom:</th>
              <td>{zoom?.toFixed(1)}</td>
            </tr>
            <tr>
              <th>Center:&nbsp;</th>
              <td>
                {center[0].toFixed(5)}, {center[1].toFixed(5)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>,
      this.element
    );
  };
}

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  infoWrap: css`
    position: absolute;
    top: 8px;
    right: 8px;
    color: ${theme.colors.text};
    background: ${tinycolor(theme.colors.panelBg).setAlpha(0.7).toString()};
    border-radius: 2px;
    padding: 8px;
  `,
}));
