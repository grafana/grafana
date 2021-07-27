import React, { PureComponent } from 'react';
import { stylesFactory } from '@grafana/ui';
import { Map } from 'ol';
import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import tinycolor from 'tinycolor2';
import { Layer } from 'ol/layer';

interface Props {
  map: Map;
  layerID: string;
}

interface State {
  visible: boolean;
  coordinates?: number[];
}

export class Tooltip extends PureComponent<Props, State> {
  style = getStyles(config.theme);

  constructor(props: Props) {
    super(props);
    this.state = { visible: false };
  }

  updateViewState = (onFeature: boolean, coordinates: number[]) => {
    this.setState({
      visible: onFeature,
      coordinates: coordinates,
    });
  };

  componentDidMount() {
    const { map, layerID } = this.props;

    map.on('pointermove', (evt: any) => {
      const pixel = map.getEventPixel(evt.originalEvent);
      const feature = map.forEachFeatureAtPixel(pixel, (feature, layer) => {
        return feature;
      });

      const coordinates = feature?.getProperties().geometry.flatCoordinates;

      if (feature && coordinates) {
        console.log('hover', feature, evt);
        this.updateViewState(true, coordinates);
      } else {
        this.updateViewState(false, [0, 0]);
      }
    });
  }

  render() {
    const { visible, coordinates } = this.state;

    let x = 0;
    let y = 0;

    if (coordinates) {
      x = coordinates[0];
      y = coordinates[1];
    }

    return (
      <div className={this.style.infoWrap}>
        {visible && (
          <table>
            <tbody>
              <tr>
                <th>Latitude:</th>
                <td>{x.toFixed(1)}</td>
              </tr>
              <tr>
                <th>Longitude:&nbsp;</th>
                <td> {y.toFixed(1)} </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  infoWrap: css`
    color: ${theme.colors.text};
    background: ${tinycolor(theme.colors.panelBg).setAlpha(0.7).toString()};
    border-radius: 2px;
    padding: 8px;
  `,
}));
