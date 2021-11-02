import { __assign } from "tslib";
import { Registry } from '@grafana/data';
import { iconItem } from './elements/icon';
import { textBoxItem } from './elements/textBox';
export var DEFAULT_CANVAS_ELEMENT_CONFIG = __assign({ type: iconItem.id }, iconItem.getNewOptions());
export var canvasElementRegistry = new Registry(function () { return [
    iconItem,
    textBoxItem,
]; });
//# sourceMappingURL=registry.js.map