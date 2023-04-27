import { Fill, RegularShape, Stroke, Circle, Style, Icon, Text } from 'ol/style';
import tinycolor from 'tinycolor2';

import { Registry, RegistryItem, textUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getPublicOrAbsoluteUrl } from 'app/features/dimensions';

import { defaultStyleConfig, DEFAULT_SIZE, StyleConfigValues, StyleMaker } from './types';

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

export function getFillColor(cfg: StyleConfigValues) {
  const opacity = cfg.opacity == null ? 0.8 : cfg.opacity;
  if (opacity === 1) {
    return new Fill({ color: cfg.color });
  }
  if (opacity > 0) {
    const color = tinycolor(cfg.color).setAlpha(opacity).toRgbString();
    return new Fill({ color });
  }
  return undefined;
}

export function getStrokeStyle(cfg: StyleConfigValues) {
  const opacity = cfg.opacity == null ? 0.8 : cfg.opacity;
  if (opacity === 1) {
    return new Stroke({ color: cfg.color, width: cfg.lineWidth ?? 1 });
  }
  if (opacity > 0) {
    const color = tinycolor(cfg.color).setAlpha(opacity).toRgbString();
    return new Stroke({ color, width: cfg.lineWidth ?? 1 });
  }
  return undefined;
}

const textLabel = (cfg: StyleConfigValues) => {
  if (!cfg.text) {
    return undefined;
  }

  const fontFamily = config.theme2.typography.fontFamily;
  const textConfig = {
    ...defaultStyleConfig.textConfig,
    ...cfg.textConfig,
  };
  return new Text({
    text: cfg.text,
    fill: new Fill({ color: cfg.color ?? defaultStyleConfig.color.fixed }),
    font: `normal ${textConfig.fontSize}px ${fontFamily}`,
    ...textConfig,
  });
};

export const textMarker = (cfg: StyleConfigValues) => {
  return new Style({
    text: textLabel(cfg),
  });
};

export const circleMarker = (cfg: StyleConfigValues) => {
  const stroke = new Stroke({ color: cfg.color, width: cfg.lineWidth ?? 1 });
  return new Style({
    image: new Circle({
      stroke,
      fill: getFillColor(cfg),
      radius: cfg.size ?? DEFAULT_SIZE,
    }),
    text: textLabel(cfg),
    stroke, // in case lines are sent to the markers layer
  });
};

// Does not have image
export const polyStyle = (cfg: StyleConfigValues) => {
  return new Style({
    fill: getFillColor(cfg),
    stroke: new Stroke({ color: cfg.color, width: cfg.lineWidth ?? 1 }),
    text: textLabel(cfg),
  });
};

export const routeStyle = (cfg: StyleConfigValues) => {
  return new Style({
    fill: getFillColor(cfg),
    stroke: getStrokeStyle(cfg),
    text: textLabel(cfg),
  });
};

// Square and cross
const errorMarker = (cfg: StyleConfigValues) => {
  const radius = cfg.size ?? DEFAULT_SIZE;
  const stroke = new Stroke({ color: '#F00', width: 1 });
  return [
    new Style({
      image: new RegularShape({
        stroke,
        points: 4,
        radius,
        angle: Math.PI / 4,
      }),
    }),
    new Style({
      image: new RegularShape({
        stroke,
        points: 4,
        radius,
        radius2: 0,
        angle: 0,
      }),
    }),
  ];
};

const makers: SymbolMaker[] = [
  {
    id: RegularShapeId.circle,
    name: 'Circle',
    aliasIds: [MarkerShapePath.circle],
    make: circleMarker,
  },
  {
    id: RegularShapeId.square,
    name: 'Square',
    aliasIds: [MarkerShapePath.square],
    make: (cfg: StyleConfigValues) => {
      const radius = cfg.size ?? DEFAULT_SIZE;
      const rotation = cfg.rotation ?? 0;
      return new Style({
        image: new RegularShape({
          stroke: new Stroke({ color: cfg.color, width: cfg.lineWidth ?? 1 }),
          fill: getFillColor(cfg),
          points: 4,
          radius,
          rotation: (rotation * Math.PI) / 180 + Math.PI / 4,
        }),
        text: textLabel(cfg),
      });
    },
  },
  {
    id: RegularShapeId.triangle,
    name: 'Triangle',
    aliasIds: [MarkerShapePath.triangle],
    make: (cfg: StyleConfigValues) => {
      const radius = cfg.size ?? DEFAULT_SIZE;
      const rotation = cfg.rotation ?? 0;
      return new Style({
        image: new RegularShape({
          stroke: new Stroke({ color: cfg.color, width: cfg.lineWidth ?? 1 }),
          fill: getFillColor(cfg),
          points: 3,
          radius,
          rotation: (rotation * Math.PI) / 180,
          angle: 0,
        }),
        text: textLabel(cfg),
      });
    },
  },
  {
    id: RegularShapeId.star,
    name: 'Star',
    aliasIds: [MarkerShapePath.star],
    make: (cfg: StyleConfigValues) => {
      const radius = cfg.size ?? DEFAULT_SIZE;
      const rotation = cfg.rotation ?? 0;
      return new Style({
        image: new RegularShape({
          stroke: new Stroke({ color: cfg.color, width: cfg.lineWidth ?? 1 }),
          fill: getFillColor(cfg),
          points: 5,
          radius,
          radius2: radius * 0.4,
          angle: 0,
          rotation: (rotation * Math.PI) / 180,
        }),
        text: textLabel(cfg),
      });
    },
  },
  {
    id: RegularShapeId.cross,
    name: 'Cross',
    aliasIds: [MarkerShapePath.cross],
    make: (cfg: StyleConfigValues) => {
      const radius = cfg.size ?? DEFAULT_SIZE;
      const rotation = cfg.rotation ?? 0;
      return new Style({
        image: new RegularShape({
          stroke: new Stroke({ color: cfg.color, width: cfg.lineWidth ?? 1 }),
          points: 4,
          radius,
          radius2: 0,
          angle: 0,
          rotation: (rotation * Math.PI) / 180,
        }),
        text: textLabel(cfg),
      });
    },
  },
  {
    id: RegularShapeId.x,
    name: 'X',
    aliasIds: [MarkerShapePath.x],
    make: (cfg: StyleConfigValues) => {
      const radius = cfg.size ?? DEFAULT_SIZE;
      const rotation = cfg.rotation ?? 0;
      return new Style({
        image: new RegularShape({
          stroke: new Stroke({ color: cfg.color, width: cfg.lineWidth ?? 1 }),
          points: 4,
          radius,
          radius2: 0,
          rotation: (rotation * Math.PI) / 180 + Math.PI / 4,
        }),
        text: textLabel(cfg),
      });
    },
  },
];

async function prepareSVG(url: string, size?: number): Promise<string> {
  return fetch(url, { method: 'GET' })
    .then((res) => {
      return res.text();
    })
    .then((text) => {
      text = textUtil.sanitizeSVGContent(text);

      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'image/svg+xml');
      const svg = doc.getElementsByTagName('svg')[0];
      if (!svg) {
        return '';
      }

      const svgSize = size ?? 100;
      const width = svg.getAttribute('width') ?? svgSize;
      const height = svg.getAttribute('height') ?? svgSize;

      // open layers requires a white fill becaues it uses tint to set color
      svg.setAttribute('fill', '#fff');
      svg.setAttribute('width', `${width}px`);
      svg.setAttribute('height', `${height}px`);
      const svgString = new XMLSerializer().serializeToString(svg);
      const svgURI = encodeURIComponent(svgString);
      return `data:image/svg+xml,${svgURI}`;
    })
    .catch((error) => {
      console.error(error); // eslint-disable-line no-console
      return '';
    });
}

// Really just a cache for the various symbol styles
const markerMakers = new Registry<SymbolMaker>(() => makers);

export function getMarkerAsPath(shape?: string): string | undefined {
  const marker = markerMakers.getIfExists(shape);
  if (marker?.aliasIds?.length) {
    return marker.aliasIds[0];
  }
  return undefined;
}

// Will prepare symbols as necessary
export async function getMarkerMaker(symbol?: string, hasTextLabel?: boolean): Promise<StyleMaker> {
  if (!symbol) {
    return hasTextLabel ? textMarker : circleMarker;
  }

  let maker = markerMakers.getIfExists(symbol);
  if (maker) {
    return maker.make;
  }

  // Prepare svg as icon
  if (symbol.endsWith('.svg')) {
    const src = await prepareSVG(getPublicOrAbsoluteUrl(symbol));
    maker = {
      id: symbol,
      name: symbol,
      aliasIds: [],
      make: src
        ? (cfg: StyleConfigValues) => {
            const radius = cfg.size ?? DEFAULT_SIZE;
            const rotation = cfg.rotation ?? 0;
            return [
              new Style({
                image: new Icon({
                  src,
                  color: cfg.color,
                  opacity: cfg.opacity ?? 1,
                  scale: (DEFAULT_SIZE + radius) / 100,
                  rotation: (rotation * Math.PI) / 180,
                }),
                text: !cfg?.text ? undefined : textLabel(cfg),
              }),
              // transparent bounding box for featureAtPixel detection
              new Style({
                image: new RegularShape({
                  fill: new Fill({ color: 'rgba(0,0,0,0)' }),
                  points: 4,
                  radius: cfg.size,
                  rotation: (rotation * Math.PI) / 180 + Math.PI / 4,
                }),
              }),
            ];
          }
        : errorMarker,
    };
    markerMakers.register(maker);
    return maker.make;
  }

  // default to showing a circle
  return errorMarker;
}
