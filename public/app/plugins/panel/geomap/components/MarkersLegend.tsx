import { css, cx } from '@emotion/css';
import BaseLayer from 'ol/layer/Base';
import { useMemo } from 'react';
import { useObservable } from 'react-use';
import { of } from 'rxjs';

import {
  getMinMaxAndDelta,
  DataFrame,
  formattedValueToString,
  getFieldColorModeForField,
  GrafanaTheme2,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2, VizLegendItem } from '@grafana/ui';
import { ColorScale } from 'app/core/components/ColorScale/ColorScale';
import { SanitizedSVG } from 'app/core/components/SVG/SanitizedSVG';
import { getThresholdItems } from 'app/core/components/TimelineChart/utils';
import { config } from 'app/core/config';
import { DimensionSupplier } from 'app/features/dimensions/types';

import { StyleConfigState } from '../style/types';
import { MapLayerState } from '../types';

export interface MarkersLegendProps {
  size?: DimensionSupplier<number>;
  layerName?: string;
  styleConfig?: StyleConfigState;
  layer?: BaseLayer;
}

export function MarkersLegend(props: MarkersLegendProps) {
  const { layerName, styleConfig, layer } = props;
  const style = useStyles2(getStyles);

  const hoverEvent = useObservable(((layer as any)?.__state as MapLayerState)?.mouseEvents ?? of(undefined));

  const colorField = styleConfig?.dims?.color?.field;
  const hoverValue = useMemo(() => {
    if (!colorField || !hoverEvent) {
      return undefined;
    }

    const props = hoverEvent.getProperties();
    const frame: DataFrame = props.frame;

    if (!frame) {
      return undefined;
    }

    const rowIndex: number = props.rowIndex;
    return colorField.values[rowIndex];
  }, [hoverEvent, colorField]);

  if (!styleConfig) {
    return <></>;
  }

  const { color, opacity } = styleConfig?.base ?? {};
  const symbol = styleConfig?.config.symbol?.fixed;

  if (color && symbol && !colorField) {
    return (
      <div className={style.infoWrap}>
        <div className={style.layerName}>{layerName}</div>
        <div className={cx(style.layerBody, style.fixedColorContainer)}>
          <SanitizedSVG
            src={`${window.__grafana_public_path__}build/${symbol}`}
            className={style.legendSymbol}
            title={t('geomap.markers-legend.title-symbol', 'Symbol')}
            style={{ fill: color, opacity: opacity }}
          />
        </div>
      </div>
    );
  }

  if (!colorField) {
    return <></>;
  }

  const colorMode = getFieldColorModeForField(colorField);

  if (colorMode.isContinuous && colorMode.getColors) {
    const colors = colorMode.getColors(config.theme2);
    const colorRange = getMinMaxAndDelta(colorField);
    // TODO: explore showing mean on the gradient scale
    // const stats = reduceField({
    //   field: color.field!,
    //   reducers: [
    //     ReducerID.min,
    //     ReducerID.max,
    //     ReducerID.mean,
    //     // std dev?
    //   ]
    // })

    const display = colorField.display
      ? (v: number) => formattedValueToString(colorField.display!(v))
      : (v: number) => `${v}`;
    return (
      <div className={style.infoWrap}>
        <div className={style.layerName}>{layerName}</div>
        <div className={cx(style.layerBody, style.colorScaleWrapper)}>
          <ColorScale
            hoverValue={hoverValue}
            colorPalette={colors}
            min={colorRange.min ?? 0}
            max={colorRange.max ?? 100}
            display={display}
            useStopsPercentage={false}
          />
        </div>
      </div>
    );
  }

  const thresholds = colorField?.config?.thresholds;
  if (!thresholds || thresholds.steps.length < 2) {
    return <div></div>; // don't show anything in the legend
  }

  const items = getThresholdItems(colorField!.config, config.theme2);
  return (
    <div className={style.infoWrap}>
      <div className={style.layerName}>{layerName}</div>
      <div className={cx(style.layerBody, style.legend)}>
        {items.map((item: VizLegendItem, idx: number) => (
          <div key={`${idx}/${item.label}`} className={style.legendItem}>
            <i style={{ background: item.color }}></i>
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  infoWrap: css({
    display: 'flex',
    flexDirection: 'column',
    background: theme.colors.background.secondary,
    // eslint-disable-next-line @grafana/no-border-radius-literal
    borderRadius: '1px',
    padding: theme.spacing(1),
    borderBottom: `2px solid ${theme.colors.border.strong}`,
    minWidth: '150px',
  }),
  layerName: css({
    fontSize: theme.typography.body.fontSize,
  }),
  layerBody: css({
    paddingLeft: '10px',
  }),
  legend: css({
    lineHeight: '18px',
    display: 'flex',
    flexDirection: 'column',
    fontSize: theme.typography.bodySmall.fontSize,
    padding: '5px 10px 0',

    i: {
      width: '15px',
      height: '15px',
      float: 'left',
      marginRight: '8px',
      opacity: 0.7,
      borderRadius: theme.shape.radius.circle,
    },
  }),
  legendItem: css({
    whiteSpace: 'nowrap',
  }),
  fixedColorContainer: css({
    minWidth: '80px',
    fontSize: theme.typography.bodySmall.fontSize,
    paddingTop: '5px',
  }),
  legendSymbol: css({
    height: '18px',
    width: '18px',
    margin: 'auto',
  }),
  colorScaleWrapper: css({
    minWidth: '200px',
    fontSize: theme.typography.bodySmall.fontSize,
    paddingTop: '10px',
  }),
});
