import { css } from '@emotion/css';
import type Map from 'ol/Map';
import { type Coordinate } from 'ol/coordinate';
import { transform } from 'ol/proj';
import { memo, useState, useEffect } from 'react';
import tinycolor from 'tinycolor2';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

interface Props {
  map: Map;
}

export const DebugOverlay = memo(function DebugOverlay({ map }: Props) {
  const style = useStyles2(getStyles);
  const [zoom, setZoom] = useState<number | undefined>(0);
  const [center, setCenter] = useState<Coordinate>([0, 0]);

  useEffect(() => {
    const updateViewState = () => {
      const view = map.getView();
      setZoom(view.getZoom());
      setCenter(transform(view.getCenter()!, view.getProjection(), 'EPSG:4326'));
    };

    map.on('moveend', updateViewState);
    updateViewState();

    return () => map.un('moveend', updateViewState);
  }, [map]);

  return (
    <div className={style.infoWrap} data-testid={selectors.components.DebugOverlay.wrapper}>
      <table>
        <tbody>
          <tr>
            <th>
              <Trans i18nKey="geomap.debug-overlay.zoom">Zoom:</Trans>
            </th>
            <td>{zoom?.toFixed(1)}</td>
          </tr>
          <tr>
            <th>
              <Trans i18nKey="geomap.debug-overlay.center">Center:</Trans>&nbsp;
            </th>
            <td>
              {center[0].toFixed(5)}, {center[1].toFixed(5)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  infoWrap: css({
    color: theme.colors.text.primary,
    background: tinycolor(theme.components.panel.background).setAlpha(0.7).toString(),
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(1),
  }),
});
