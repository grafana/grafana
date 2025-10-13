import { Registry } from '@grafana/data';

import { CanvasElementItem, CanvasElementOptions } from './element';
import { buttonItem } from './elements/button';
import { cloudItem } from './elements/cloud';
import { droneFrontItem } from './elements/droneFront';
import { droneSideItem } from './elements/droneSide';
import { droneTopItem } from './elements/droneTop';
import { ellipseItem } from './elements/ellipse';
import { iconItem } from './elements/icon';
import { metricValueItem } from './elements/metricValue';
import { parallelogramItem } from './elements/parallelogram';
import { rectangleItem } from './elements/rectangle';
import { serverItem } from './elements/server/server';
import { textItem } from './elements/text';
import { triangleItem } from './elements/triangle';
import { windTurbineItem } from './elements/windTurbine';

export const DEFAULT_CANVAS_ELEMENT_CONFIG: CanvasElementOptions = {
  ...metricValueItem.getNewOptions(),
  placement: { ...metricValueItem.getNewOptions().placement, ...metricValueItem.defaultSize },
  type: metricValueItem.id,
  name: `Element 1`,
};

export const defaultElementItems = [
  metricValueItem, // default for now
  textItem,
  ellipseItem,
  rectangleItem,
  iconItem,
  serverItem,
  triangleItem,
  cloudItem,
  parallelogramItem,
];

export const advancedElementItems = [buttonItem, windTurbineItem, droneTopItem, droneFrontItem, droneSideItem];

export const canvasElementRegistry = new Registry<CanvasElementItem>(() => [
  ...defaultElementItems,
  ...advancedElementItems,
]);
