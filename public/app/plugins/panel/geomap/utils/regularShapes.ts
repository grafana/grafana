import { Fill, RegularShape, Stroke, Style, Circle } from 'ol/style';

type markerCreator = (color: string, fillColor: string, radius: number) => Style;
const square: markerCreator = (color: string, fillColor: string, radius: number) =>
  new Style({
    image: new RegularShape({
      fill: new Fill({ color: fillColor }),
      stroke: new Stroke({ color: color, width: 1 }),
      points: 4,
      radius: radius,
      angle: Math.PI / 4,
    }),
  });
const circle = (color: string, fillColor: string, radius: number) =>
  new Style({
    image: new Circle({
      // Stroke determines the outline color of the circle
      stroke: new Stroke({ color: color }),
      // Fill determines the color to fill the whole circle
      fill: new Fill({ color: fillColor }),
      radius: radius,
    }),
  });
const triangle = (color: string, fillColor: string, radius: number) =>
  new Style({
    image: new RegularShape({
      fill: new Fill({ color: fillColor }),
      stroke: new Stroke({ color: color, width: 1 }),
      points: 3,
      radius: radius,
      rotation: Math.PI / 4,
      angle: 0,
    }),
  });
const star = (color: string, fillColor: string, radius: number) =>
  new Style({
    image: new RegularShape({
      fill: new Fill({ color: fillColor }),
      stroke: new Stroke({ color: color, width: 1 }),
      points: 5,
      radius: radius,
      radius2: 4,
      angle: 0,
    }),
  });
const cross = (color: string, fillColor: string, radius: number) =>
  new Style({
    image: new RegularShape({
      fill: new Fill({ color: fillColor }),
      stroke: new Stroke({ color: color, width: 1 }),
      points: 4,
      radius: radius,
      radius2: 0,
      angle: 0,
    }),
  });
const x = (color: string, fillColor: string, radius: number) =>
  new Style({
    image: new RegularShape({
      fill: new Fill({ color: fillColor }),
      stroke: new Stroke({ color: color, width: 1 }),
      points: 4,
      radius: radius,
      radius2: 0,
      angle: Math.PI / 4,
    }),
  });
interface Shapes {
  label: string;
  value: Style;
}
export const shapes = (color: string, fillColor: string, radius: number): Shapes[] => [
  {
    label: 'circle',
    value: circle(color, fillColor, radius),
  },
  {
    label: 'square',
    value: square(color, fillColor, radius),
  },
  {
    label: 'triangle',
    value: triangle(color, fillColor, radius),
  },
  {
    label: 'star',
    value: star(color, fillColor, radius),
  },
  {
    label: 'cross',
    value: cross(color, fillColor, radius),
  },
  {
    label: 'x',
    value: x(color, fillColor, radius),
  },
];
