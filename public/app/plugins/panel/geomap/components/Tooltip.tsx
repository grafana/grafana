import React, { PureComponent } from 'react';
import { Portal, stylesFactory, VizTooltipContainer } from '@grafana/ui';
import { Map, MapBrowserEvent } from 'ol';
import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import tinycolor from 'tinycolor2';
import { toLonLat } from 'ol/proj';

interface Props {
  map: Map;
}

interface State {
  visible: boolean;
  lonLat?: number[];
  pageX: number;
  pageY: number;
}

export class Tooltip extends PureComponent<Props, State> {
  style = getStyles(config.theme);

  constructor(props: Props) {
    super(props);
    this.state = { visible: false, pageX: 0, pageY: 0 };
  }

  componentDidMount() {
    const { map } = this.props;

    map.on('pointermove', (evt: MapBrowserEvent) => {
      const mouse = evt.originalEvent as any;
      const update: State = { visible: false, pageX: mouse.pageX, pageY: mouse.pageY };
      const pixel = map.getEventPixel(mouse);
      map.forEachFeatureAtPixel(pixel, (feature, layer, geo) => {
        if (!update.visible) {
          update.lonLat = toLonLat(geo.getFlatCoordinates());
          update.visible = true;
        }
      });
      this.setState(update);
    });
  }

  render() {
    const { visible, pageX, pageY, lonLat } = this.state;

    if (visible && lonLat) {
      return (
        <Portal>
          <VizTooltipContainer position={{ x: pageX, y: pageY }} offset={{ x: 10, y: 10 }}>
            <div className={this.style.infoWrap}>
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
            </div>
          </VizTooltipContainer>
        </Portal>
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
