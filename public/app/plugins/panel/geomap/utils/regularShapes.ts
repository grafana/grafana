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
  Circle = 'circle',
  Square = 'square',
  Triangle = 'triangle',
  Star = 'star',
  Cross = 'cross',
  X = 'x',
}

export enum MarkerShapePath {
  Circle = 'img/icons/marker/circle.svg',
  Square = 'img/icons/marker/square.svg',
  Triangle = 'img/icons/marker/triangle.svg',
  Star = 'img/icons/marker/star.svg',
  Cross = 'img/icons/marker/cross.svg',
  X = 'img/icons/marker/x-mark.svg',
}

export const circleMarker: MarkerMaker = {
  id: RegularShapeId.Circle,
  name: 'Circle',
  hasFill: true,
  aliasIds: [MarkerShapePath.Circle],
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
    id: RegularShapeId.Square,
    name: 'Square',
    hasFill: true,
    aliasIds: [MarkerShapePath.Square],
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
    id: RegularShapeId.Triangle,
    name: 'Triangle',
    hasFill: true,
    aliasIds: [MarkerShapePath.Triangle],
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
    id: RegularShapeId.Star,
    name: 'Star',
    hasFill: true,
    aliasIds: [MarkerShapePath.Star],
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
    id: RegularShapeId.Cross,
    name: 'Cross',
    hasFill: false,
    aliasIds: [MarkerShapePath.Cross],
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
    id: RegularShapeId.X,
    name: 'X',
    hasFill: false,
    aliasIds: [MarkerShapePath.X],
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
