import { Fill, RegularShape, Stroke, Style } from 'ol/style';

const square = (color: string) =>
  new Style({
    image: new RegularShape({
      fill: new Fill({ color: color }),
      stroke: new Stroke({ color: color, width: 1 }),
      points: 4,
      radius: 10,
      angle: Math.PI / 4,
    }),
  });
const rectangle = (color: string) =>
  new Style({
    image: new RegularShape({
      fill: new Fill({ color: color }),
      stroke: new Stroke({ color: color, width: 1 }),
      radius: 10 / Math.SQRT2,
      radius2: 10,
      points: 4,
      angle: 0,
      scale: [1, 0.5],
    }),
  });
const triangle = (color: string) =>
  new Style({
    image: new RegularShape({
      fill: new Fill({ color: color }),
      stroke: new Stroke({ color: color, width: 1 }),
      points: 3,
      radius: 10,
      rotation: Math.PI / 4,
      angle: 0,
    }),
  });
interface Shapes {
  label: string;
  value: Style;
}
export const shapes = (color: string): Shapes[] => [
  {
    label: 'square',
    value: square(color),
  },
  {
    label: 'rectangle',
    value: rectangle(color),
  },
  {
    label: 'triangle',
    value: triangle(color),
  },
];
