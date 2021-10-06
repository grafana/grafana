import { Fill, RegularShape, Stroke, Style, Circle } from 'ol/style';
import { Registry, RegistryItem } from '@grafana/data';

export type StyleMaker = (color: string, fillColor: string, radius: number, markerPath?: string) => Style;

export interface MarkerMaker extends RegistryItem {
  // path to icon that will be shown (but then replaced)
  aliasIds: string[];
  make: StyleMaker;
  hasFill: boolean;
}

export enum RegularShapeId {
  circle = 'circle',
  square = 'square',
  triangle = 'triangle',
  star = 'star',
  cross = 'cross',
  x = 'x',
}

export const shapeByPathLookup = {
  'img/icons/geo/circle.svg': RegularShapeId.circle,
  'img/icons/geo/square.svg': RegularShapeId.square,
  'img/icons/geo/triangle.svg': RegularShapeId.triangle,
  'img/icons/geo/star.svg': RegularShapeId.star,
  'img/icons/geo/cross.svg': RegularShapeId.cross,
  'img/icons/geo/x-mark.svg': RegularShapeId.x,
};

export const circleMarker: MarkerMaker = {
  id: RegularShapeId.circle,
  name: 'Circle',
  hasFill: true,
  aliasIds: ['img/icons/geo/circle.svg'],
  make: (color: string, fillColor: string, radius: number) => {
    return new Style({
      image: new Circle({
        stroke: new Stroke({ color: color }),
        fill: new Fill({ color: fillColor }),
        radius: radius,
      }),
    });
  },
};

const makers: MarkerMaker[] = [
  circleMarker,
  {
    id: RegularShapeId.square,
    name: 'Square',
    hasFill: true,
    aliasIds: ['img/icons/geo/square.svg'],
    make: (color: string, fillColor: string, radius: number) => {
      return new Style({
        image: new RegularShape({
          fill: new Fill({ color: fillColor }),
          stroke: new Stroke({ color: color, width: 1 }),
          points: 4,
          radius: radius,
          angle: Math.PI / 4,
        }),
      });
    },
  },
  {
    id: RegularShapeId.triangle,
    name: 'Triangle',
    hasFill: true,
    aliasIds: ['img/icons/geo/triangle.svg'],
    make: (color: string, fillColor: string, radius: number) => {
      return new Style({
        image: new RegularShape({
          fill: new Fill({ color: fillColor }),
          stroke: new Stroke({ color: color, width: 1 }),
          points: 3,
          radius: radius,
          rotation: Math.PI / 4,
          angle: 0,
        }),
      });
    },
  },
  {
    id: RegularShapeId.star,
    name: 'Star',
    hasFill: true,
    aliasIds: ['img/icons/geo/star.svg'],
    make: (color: string, fillColor: string, radius: number) => {
      return new Style({
        image: new RegularShape({
          fill: new Fill({ color: fillColor }),
          stroke: new Stroke({ color: color, width: 1 }),
          points: 5,
          radius: radius,
          radius2: radius * 0.4,
          angle: 0,
        }),
      });
    },
  },
  {
    id: RegularShapeId.cross,
    name: 'Cross',
    hasFill: false,
    aliasIds: ['img/icons/geo/cross.svg'],
    make: (color: string, fillColor: string, radius: number) => {
      return new Style({
        image: new RegularShape({
          fill: new Fill({ color: fillColor }),
          stroke: new Stroke({ color: color, width: 1 }),
          points: 4,
          radius: radius,
          radius2: 0,
          angle: 0,
        }),
      });
    },
  },
  {
    id: RegularShapeId.x,
    name: 'X',
    hasFill: false,
    aliasIds: ['img/icons/geo/x-mark.svg'],
    make: (color: string, fillColor: string, radius: number) => {
      return new Style({
        image: new RegularShape({
          fill: new Fill({ color: fillColor }),
          stroke: new Stroke({ color: color, width: 1 }),
          points: 4,
          radius: radius,
          radius2: 0,
          angle: Math.PI / 4,
        }),
      });
    },
  },
];

export const markerMakers = new Registry<MarkerMaker>(() => makers);

export const getMarkerFromPath = (svgPath: string): MarkerMaker | undefined => {
  for (const [key, val] of Object.entries(shapeByPathLookup)) {
    if (key === svgPath) {
      console.log('key', key);
      return markerMakers.getIfExists(val);
    }
  }
  return undefined;
};
