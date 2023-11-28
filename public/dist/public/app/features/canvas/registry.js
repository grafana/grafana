import { Registry } from '@grafana/data';
import { buttonItem } from './elements/button';
import { droneFrontItem } from './elements/droneFront';
import { droneSideItem } from './elements/droneSide';
import { droneTopItem } from './elements/droneTop';
import { ellipseItem } from './elements/ellipse';
import { iconItem } from './elements/icon';
import { metricValueItem } from './elements/metricValue';
import { rectangleItem } from './elements/rectangle';
import { serverItem } from './elements/server/server';
import { textItem } from './elements/text';
import { windTurbineItem } from './elements/windTurbine';
export const DEFAULT_CANVAS_ELEMENT_CONFIG = Object.assign(Object.assign({}, metricValueItem.getNewOptions()), { placement: Object.assign(Object.assign({}, metricValueItem.getNewOptions().placement), metricValueItem.defaultSize), type: metricValueItem.id, name: `Element 1` });
export const defaultElementItems = [
    metricValueItem,
    textItem,
    ellipseItem,
    rectangleItem,
    iconItem,
    serverItem,
];
export const advancedElementItems = [buttonItem, windTurbineItem, droneTopItem, droneFrontItem, droneSideItem];
export const canvasElementRegistry = new Registry(() => [
    ...defaultElementItems,
    ...advancedElementItems,
]);
//# sourceMappingURL=registry.js.map