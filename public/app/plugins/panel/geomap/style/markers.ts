import { Fill, RegularShape, Stroke, Circle, Style, Icon } from 'ol/style';
import { Registry, RegistryItem } from '@grafana/data';
import { StyleConfigValues, StyleMaker } from './types';
import { getPublicOrAbsoluteUrl } from 'app/features/dimensions';

const DEFAULT_SIZE = 5;

interface SymbolMaker extends RegistryItem {
  aliasIds: string[];
  make: StyleMaker;
}

enum RegularShapeId {
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

export const circleMarker: SymbolMaker = {
  id: RegularShapeId.circle,
  name: 'Circle',
  aliasIds: [MarkerShapePath.circle],
  make: (cfg: StyleConfigValues) => {
    return new Style({
      image: new Circle({
        ...getStrokeAndFill(cfg),
        radius: cfg.size ?? DEFAULT_SIZE,
      }),
    });
  },
};

const makers: SymbolMaker[] = [
  circleMarker,
  {
    id: RegularShapeId.square,
    name: 'Square',
    aliasIds: [MarkerShapePath.square],
    make: (cfg: StyleConfigValues) => {
      const radius = cfg.size ?? DEFAULT_SIZE;
      return new Style({
        image: new RegularShape({
          ...getStrokeAndFill(cfg),
          points: 4,
          radius,
          angle: Math.PI / 4,
        }),
      });
    },
  },
  {
    id: RegularShapeId.triangle,
    name: 'Triangle',
    aliasIds: [MarkerShapePath.triangle],
    make: (cfg: StyleConfigValues) => {
      const radius = cfg.size ?? DEFAULT_SIZE;
      return new Style({
        image: new RegularShape({
          ...getStrokeAndFill(cfg),
          points: 3,
          radius,
          rotation: Math.PI / 4,
          angle: 0,
        }),
      });
    },
  },
  {
    id: RegularShapeId.star,
    name: 'Star',
    aliasIds: [MarkerShapePath.star],
    make: (cfg: StyleConfigValues) => {
      const radius = cfg.size ?? DEFAULT_SIZE;
      return new Style({
        image: new RegularShape({
          ...getStrokeAndFill(cfg),
          points: 5,
          radius,
          radius2: radius * 0.4,
          angle: 0,
        }),
      });
    },
  },
  {
    id: RegularShapeId.cross,
    name: 'Cross',
    aliasIds: [MarkerShapePath.cross],
    make: (cfg: StyleConfigValues) => {
      const radius = cfg.size ?? DEFAULT_SIZE;
      return new Style({
        image: new RegularShape({
          ...getStrokeAndFill(cfg),
          points: 4,
          radius,
          radius2: 0,
          angle: 0,
        }),
      });
    },
  },
  {
    id: RegularShapeId.x,
    name: 'X',
    aliasIds: [MarkerShapePath.x],
    make: (cfg: StyleConfigValues) => {
      const radius = cfg.size ?? DEFAULT_SIZE;
      return new Style({
        image: new RegularShape({
          ...getStrokeAndFill(cfg),
          points: 4,
          radius,
          radius2: 0,
          angle: Math.PI / 4,
        }),
      });
    },
  },
];

// Really just a cache for the various symbol styles
const markerMakers = new Registry<SymbolMaker>(() => makers);

// Will prepare symbols as necessary
export async function getMarkerMaker(symbol?: string): Promise<StyleMaker> {
  if (!symbol) {
    return circleMarker.make;
  }

  const maker = markerMakers.getIfExists(symbol);
  if (maker) {
    return maker.make;
  }

  // TODO: prepare the svg
  if (symbol.endsWith('.svg')) {
    const absolute = getPublicOrAbsoluteUrl(symbol);

    const svg = (cfg: StyleConfigValues) => {
      const radius = cfg.size ?? DEFAULT_SIZE;
      return new Style({
        image: new Icon({
          src: absolute,
          color: cfg.fillColor,
          //  opacity,
          scale: (DEFAULT_SIZE + radius) / 100,
        }),
      });
    };

    return svg;
  }

  // defatult to showing a circle
  return circleMarker.make;
}
