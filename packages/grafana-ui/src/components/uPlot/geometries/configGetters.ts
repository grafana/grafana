import { AreaProps, LineProps, PointProps } from './types';
import tinycolor from 'tinycolor2';
import { getColorFromHexRgbOrName } from '@grafana/data';

export const getAreaConfig = (props: AreaProps) => {
  const fill = props.fill
    ? tinycolor(getColorFromHexRgbOrName(props.color))
        .setAlpha(props.fill)
        .toRgbString()
    : undefined;

  return {
    scale: props.scaleKey,
    fill,
  };
};

export const getLineConfig = (props: LineProps) => {
  return {
    scale: props.scaleKey,
    stroke: props.stroke,
    width: props.width,
  };
};

export const getPointConfig = (props: PointProps) => {
  return {
    scale: props.scaleKey,
    stroke: props.stroke,
    points: {
      show: true,
      size: props.size,
      stroke: props.stroke,
    },
  };
};
