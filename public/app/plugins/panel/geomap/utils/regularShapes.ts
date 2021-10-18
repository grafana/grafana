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

const MarkerShapePath = {
  circle: 'img/icons/marker/circle.svg',
  square: 'img/icons/marker/square.svg',
  triangle: 'img/icons/marker/triangle.svg',
  star: 'img/icons/marker/star.svg',
  cross: 'img/icons/marker/cross.svg',
  x: 'img/icons/marker/x-mark.svg',
};

export const circleMarker: MarkerMaker = {
  id: RegularShapeId.circle,
  name: 'Circle',
  hasFill: true,
  aliasIds: [MarkerShapePath.circle],
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
    aliasIds: [MarkerShapePath.square],
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
    aliasIds: [MarkerShapePath.triangle],
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
    aliasIds: [MarkerShapePath.star],
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
    aliasIds: [MarkerShapePath.cross],
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
    aliasIds: [MarkerShapePath.x],
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
  for (const [key, val] of Object.entries(MarkerShapePath)) {
    if (val === svgPath) {
      return markerMakers.getIfExists(key);
    }
  }
  return undefined;
};
