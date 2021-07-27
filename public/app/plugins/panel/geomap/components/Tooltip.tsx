import React, { PureComponent } from 'react';
import { stylesFactory } from '@grafana/ui';
import { Map } from 'ol';
import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import tinycolor from 'tinycolor2';
import RenderFeature from 'ol/render/Feature';
import { FeatureLike } from 'ol/Feature';
import { Pixel } from 'ol/pixel';

interface Props {
  map: Map;
}

interface State {
  visible: boolean;
  coordinates: number[];
}

export class Tooltip extends PureComponent<Props, State> {
  style = getStyles(config.theme);

  constructor(props: Props) {
    super(props);
    this.state = { visible: false, coordinates: [0, 0] };
  }

  updateViewState = (features: FeatureLike[], pixel: Pixel) => {
    if (features.length > 0) {
      const firstFeature = features[0];
      console.log(firstFeature.getProperties());
      this.setState({
        visible: true,
        coordinates: firstFeature.getProperties().geometry.flatCoordinates,
      });
    } else {
      this.setState({
        visible: false,
        coordinates: [0, 0],
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
      console.log('hover', features, evt);
      this.updateViewState(features, pixel);
    });
  }

  render() {
    const { visible, coordinates } = this.state;

    return (
      <div className={this.style.infoWrap}>
        {visible && (
          <table>
            <tbody>
              <tr>
                <th>Latitude:</th>
                <td>{coordinates[0].toFixed(1)}</td>
              </tr>
              <tr>
                <th>Longitude:&nbsp;</th>
                <td> {coordinates[1].toFixed(1)} </td>
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
