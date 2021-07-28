import React, { PureComponent } from 'react';
import { stylesFactory } from '@grafana/ui';
import { Map } from 'ol';
import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import tinycolor from 'tinycolor2';
import { FeatureLike } from 'ol/Feature';
import { Pixel } from 'ol/pixel';
import { toLonLat } from 'ol/proj';

interface Props {
  map: Map;
}

interface State {
  visible: boolean;
  coordinates?: number[];
  position?: number[];
}

export class Tooltip extends PureComponent<Props, State> {
  style = getStyles(config.theme);

  constructor(props: Props) {
    super(props);
    this.state = { visible: false };
  }

  updateViewState = (features: FeatureLike[], pixel: Pixel) => {
    if (features.length > 0) {
      const firstFeature = features[0];
      this.setState({
        visible: true,
        coordinates: firstFeature.getProperties().geometry.flatCoordinates,
      });
    } else {
      this.setState({
        visible: false,
      });
    }
  };

  componentDidMount() {
    const { map } = this.props;

    map.on('pointermove', (evt: any) => {
      const features: FeatureLike[] = [];
      const pixel = map.getEventPixel(evt.originalEvent);
      map.forEachFeatureAtPixel(pixel, function (feature) {
        features.push(feature);
      });
      this.updateViewState(features, pixel);
    });
  }

  render() {
    const { visible, coordinates } = this.state;

    if (visible && coordinates) {
      const lonLat = toLonLat(coordinates, 'EPSG:3857');

      return (
        <div className={this.style.infoWrap}>
          {visible && (
            <table>
              <tbody>
                <tr>
                  <th>Latitude:</th>
                  <td>{lonLat[1].toFixed(3)}</td>
                </tr>
                <tr>
                  <th>Longitude:&nbsp;</th>
                  <td> {lonLat[0].toFixed(3)} </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      );
    } else {
      return <></>;
    }
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
