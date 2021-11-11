import { Fill, RegularShape, Stroke, Circle } from 'ol/style';
import { Registry, RegistryItem } from '@grafana/data';
import { StyleConfigValues, StyleImageMaker } from './types';

interface MarkerMaker extends RegistryItem {
  aliasIds: string[];
  make: StyleImageMaker;
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

function getStrokeAndFill(cfg: StyleConfigValues) {
  return {
    stroke: cfg.lineColor ? new Stroke({ color: cfg.lineColor, width: cfg.lineWidth ?? 1 }) : undefined,
    fill: cfg.fillColor ? new Fill({ color: cfg.fillColor }) : undefined,
  };
}

export const circleMarker: MarkerMaker = {
  id: RegularShapeId.circle,
  name: 'Circle',
  aliasIds: [MarkerShapePath.circle],
  make: (cfg: StyleConfigValues) => {
    return new Circle({
      ...getStrokeAndFill(cfg),
      radius: cfg.size ?? 5,
    });
  },
};

const makers: MarkerMaker[] = [
  circleMarker,
  {
    id: RegularShapeId.square,
    name: 'Square',
    aliasIds: [MarkerShapePath.square],
    make: (cfg: StyleConfigValues) => {
      const radius = cfg.size ?? 5;
      return new RegularShape({
        ...getStrokeAndFill(cfg),
        points: 4,
        radius,
        angle: Math.PI / 4,
      });
    },
  },
  {
    id: RegularShapeId.triangle,
    name: 'Triangle',
    aliasIds: [MarkerShapePath.triangle],
    make: (cfg: StyleConfigValues) => {
      const radius = cfg.size ?? 5;
      return new RegularShape({
        ...getStrokeAndFill(cfg),
        points: 3,
        radius,
        rotation: Math.PI / 4,
        angle: 0,
      });
    },
  },
  {
    id: RegularShapeId.star,
    name: 'Star',
    aliasIds: [MarkerShapePath.star],
    make: (cfg: StyleConfigValues) => {
      const radius = cfg.size ?? 5;
      return new RegularShape({
        ...getStrokeAndFill(cfg),
        points: 5,
        radius,
        radius2: radius * 0.4,
        angle: 0,
      });
    },
  },
  {
    id: RegularShapeId.cross,
    name: 'Cross',
    aliasIds: [MarkerShapePath.cross],
    make: (cfg: StyleConfigValues) => {
      const radius = cfg.size ?? 5;
      return new RegularShape({
        ...getStrokeAndFill(cfg),
        points: 4,
        radius,
        radius2: 0,
        angle: 0,
      });
    },
  },
  {
    id: RegularShapeId.x,
    name: 'X',
    aliasIds: [MarkerShapePath.x],
    make: (cfg: StyleConfigValues) => {
      const radius = cfg.size ?? 5;
      return new RegularShape({
        ...getStrokeAndFill(cfg),
        points: 4,
        radius,
        radius2: 0,
        angle: Math.PI / 4,
      });
    },
  },
];

// Really just a cache for the various symbol styles
export const markerMakers = new Registry<MarkerMaker>(() => makers);

// Will prepare symbols as necessary
export const getSymbolMaker = (symbol: string): StyleImageMaker => {
  const maker = markerMakers.getIfExists(symbol);
  if (maker) {
    return maker.make;
  }

  for (const [key, val] of Object.entries(MarkerShapePath)) {
    if (val === svgPath) {
      return markerMakers.getIfExists(key);
    }
  }
  return undefined;
};
