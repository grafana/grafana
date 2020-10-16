import { AreaProps, LineProps, PointProps } from './types';
import tinycolor from 'tinycolor2';

export const getAreaConfig = (props: AreaProps) => {
  // TODO can we pass therem here? or make sure color is already correct?
  const fill = props.fill
    ? tinycolor(props.color)
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
