import React, { PureComponent } from 'react';
import { stylesFactory } from '@grafana/ui';
import { Map } from 'ol';
import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import tinycolor from 'tinycolor2';

interface Props {
  map: Map;
}

interface State {
  visible: boolean;
  x?: number;
  y?: number;
}

export class Tooltip extends PureComponent<Props, State> {
  style = getStyles(config.theme);

  constructor(props: Props) {
    super(props);
    this.state = { visible: false };
  }

  updateViewState = (onFeature: boolean) => {
    this.setState({
      visible: onFeature,
    });
  };

  componentDidMount() {
    const { map } = this.props;

    map.on('pointermove', (evt: any) => {
      const pixel = map.getEventPixel(evt.originalEvent);
      const feature = map.forEachFeatureAtPixel(pixel, function (feature) {
        return feature;
      });

      if (feature) {
        console.log('hover', feature, evt);
        this.updateViewState(true);
      } else {
        this.updateViewState(false);
      }
    });

    this.updateViewState(false);
  }

  render() {
    const { visible, x, y } = this.state;

    return (
      <div className={this.style.infoWrap}>
        {visible && (
          <table>
            <tbody>
              <tr>
                <th>Latitude:</th>
                <td>{x?.toFixed(1)}</td>
              </tr>
              <tr>
                <th>Longitude:&nbsp;</th>
                <td> {y?.toFixed(5)} </td>
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
