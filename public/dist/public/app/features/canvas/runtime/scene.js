import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { ReplaySubject, Subject } from 'rxjs';
import Moveable from 'moveable';
import Selecto from 'selecto';
import { config } from 'app/core/config';
import { stylesFactory } from '@grafana/ui';
import { DEFAULT_CANVAS_ELEMENT_CONFIG } from 'app/features/canvas';
import { getColorDimensionFromData, getScaleDimensionFromData, getResourceDimensionFromData, getTextDimensionFromData, } from 'app/features/dimensions/utils';
import { RootElement } from './root';
var Scene = /** @class */ (function () {
    function Scene(cfg, enableEditing, onSave) {
        var _this = this;
        this.onSave = onSave;
        this.styles = getStyles(config.theme2);
        this.selection = new ReplaySubject(1);
        this.moved = new Subject(); // called after resize/drag for editor updates
        this.revId = 0;
        this.width = 0;
        this.height = 0;
        this.style = {};
        this.context = {
            getColor: function (color) { return getColorDimensionFromData(_this.data, color); },
            getScale: function (scale) { return getScaleDimensionFromData(_this.data, scale); },
            getText: function (text) { return getTextDimensionFromData(_this.data, text); },
            getResource: function (res) { return getResourceDimensionFromData(_this.data, res); },
        };
        this.save = function () {
            _this.onSave(_this.root.getSaveModel());
        };
        this.findElementByTarget = function (target) {
            return _this.root.elements.find(function (element) { return element.div === target; });
        };
        this.setRef = function (sceneContainer) {
            _this.div = sceneContainer;
        };
        this.initMoveable = function (destroySelecto, allowChanges) {
            var _a;
            if (destroySelecto === void 0) { destroySelecto = false; }
            if (allowChanges === void 0) { allowChanges = true; }
            var targetElements = [];
            _this.root.elements.forEach(function (element) {
                targetElements.push(element.div);
            });
            if (destroySelecto) {
                (_a = _this.selecto) === null || _a === void 0 ? void 0 : _a.destroy();
            }
            _this.selecto = new Selecto({
                container: _this.div,
                selectableTargets: targetElements,
                selectByClick: true,
            });
            var moveable = new Moveable(_this.div, {
                draggable: allowChanges,
                resizable: allowChanges,
                origin: false,
            })
                .on('clickGroup', function (event) {
                _this.selecto.clickTarget(event.inputEvent, event.inputTarget);
            })
                .on('drag', function (event) {
                var targetedElement = _this.findElementByTarget(event.target);
                targetedElement.applyDrag(event);
                _this.moved.next(Date.now()); // TODO only on end
            })
                .on('dragGroup', function (e) {
                e.events.forEach(function (event) {
                    var targetedElement = _this.findElementByTarget(event.target);
                    targetedElement.applyDrag(event);
                });
                _this.moved.next(Date.now()); // TODO only on end
            })
                .on('dragEnd', function (event) {
                var targetedElement = _this.findElementByTarget(event.target);
                if (targetedElement && targetedElement.parent) {
                    var parent_1 = targetedElement.parent;
                    targetedElement.updateSize(parent_1.width, parent_1.height);
                }
            })
                .on('resize', function (event) {
                var targetedElement = _this.findElementByTarget(event.target);
                targetedElement.applyResize(event);
                _this.moved.next(Date.now()); // TODO only on end
            })
                .on('resizeGroup', function (e) {
                e.events.forEach(function (event) {
                    var targetedElement = _this.findElementByTarget(event.target);
                    targetedElement.applyResize(event);
                });
                _this.moved.next(Date.now()); // TODO only on end
            });
            var targets = [];
            _this.selecto.on('dragStart', function (event) {
                var selectedTarget = event.inputEvent.target;
                var isTargetMoveableElement = moveable.isMoveableElement(selectedTarget) ||
                    targets.some(function (target) { return target === selectedTarget || target.contains(selectedTarget); });
                if (isTargetMoveableElement) {
                    // Prevent drawing selection box when selected target is a moveable element
                    event.stop();
                }
            }).on('selectEnd', function (event) {
                targets = event.selected;
                moveable.target = targets;
                var s = event.selected.map(function (t) { return _this.findElementByTarget(t); });
                _this.selection.next(s);
                if (event.isDragStart) {
                    event.inputEvent.preventDefault();
                    setTimeout(function () {
                        moveable.dragStart(event.inputEvent);
                    });
                }
            });
        };
        this.root = this.load(cfg, enableEditing);
    }
    Scene.prototype.load = function (cfg, enableEditing) {
        var _this = this;
        this.root = new RootElement(cfg !== null && cfg !== void 0 ? cfg : {
            type: 'group',
            elements: [DEFAULT_CANVAS_ELEMENT_CONFIG],
        }, this, this.save // callback when changes are made
        );
        setTimeout(function () {
            if (_this.div) {
                // If editing is enabled, clear selecto instance
                var destroySelecto = enableEditing;
                _this.initMoveable(destroySelecto, enableEditing);
            }
        }, 100);
        return this.root;
    };
    Scene.prototype.updateData = function (data) {
        this.data = data;
        this.root.updateData(this.context);
    };
    Scene.prototype.updateSize = function (width, height) {
        var _a;
        this.width = width;
        this.height = height;
        this.style = { width: width, height: height };
        this.root.updateSize(width, height);
        if ((_a = this.selecto) === null || _a === void 0 ? void 0 : _a.getSelectedTargets().length) {
            this.clearCurrentSelection();
        }
    };
    Scene.prototype.clearCurrentSelection = function () {
        var _a;
        var event = new MouseEvent('click');
        (_a = this.selecto) === null || _a === void 0 ? void 0 : _a.clickTarget(event, this.div);
    };
    Scene.prototype.toggleAnchor = function (element, k) {
        var _a, _b, _c, _d;
        console.log('TODO, smarter toggle', element.UID, element.anchor, k);
        var div = element.div;
        if (!div) {
            console.log('Not ready');
            return;
        }
        var w = (_b = (_a = element.parent) === null || _a === void 0 ? void 0 : _a.width) !== null && _b !== void 0 ? _b : 100;
        var h = (_d = (_c = element.parent) === null || _c === void 0 ? void 0 : _c.height) !== null && _d !== void 0 ? _d : 100;
        // Get computed position....
        var info = div.getBoundingClientRect(); // getElementInfo(div, element.parent?.div);
        console.log('DIV info', div);
        var placement = {
            top: info.top,
            left: info.left,
            width: info.width,
            height: info.height,
            bottom: h - info.bottom,
            right: w - info.right,
        };
        console.log('PPP', placement);
        // // TODO: needs to recalculate placement based on absolute values...
        // element.anchor[k] = !Boolean(element.anchor[k]);
        // element.placement = placement;
        // element.validatePlacement();
        // element.revId++;
        // this.revId++;
        //    this.save();
        this.moved.next(Date.now());
    };
    Scene.prototype.render = function () {
        return (React.createElement("div", { key: this.revId, className: this.styles.wrap, style: this.style, ref: this.setRef }, this.root.render()));
    };
    return Scene;
}());
export { Scene };
var getStyles = stylesFactory(function (theme) { return ({
    wrap: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    overflow: hidden;\n    position: relative;\n  "], ["\n    overflow: hidden;\n    position: relative;\n  "]))),
    toolbar: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    position: absolute;\n    bottom: 0;\n    margin: 10px;\n  "], ["\n    position: absolute;\n    bottom: 0;\n    margin: 10px;\n  "]))),
}); });
var templateObject_1, templateObject_2;
//# sourceMappingURL=scene.js.map