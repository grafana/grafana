import { css } from '@emotion/css';
import { Map } from 'ol';
import { Coordinate } from 'ol/coordinate';
import { transform } from 'ol/proj';
import React, { PureComponent } from 'react';
import tinycolor from 'tinycolor2';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors/src';
import { stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';

interface Props {
  map: Map;
}

interface State {
  zoom?: number;
  center: Coordinate;
}

export class DebugOverlay extends PureComponent<Props, State> {
  style = getStyles(config.theme2);

  constructor(props: Props) {
    super(props);
    this.state = { zoom: 0, center: [0, 0] };
  }

  updateViewState = () => {
    const view = this.props.map.getView();
    this.setState({
      zoom: view.getZoom(),
      center: transform(view.getCenter()!, view.getProjection(), 'EPSG:4326'),
    });
  };

  componentDidMount() {
    this.props.map.on('moveend', this.updateViewState);
    this.updateViewState();
  }

  render() {
    const { zoom, center } = this.state;

    return (
      <div className={this.style.infoWrap} aria-label={selectors.components.DebugOverlay.wrapper}>
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
      </div>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  infoWrap: css`
    color: ${theme.colors.text.primary};
    background: ${tinycolor(theme.components.panel.background).setAlpha(0.7).toString()};
    border-radius: 2px;
    padding: 8px;
  `,
}));
