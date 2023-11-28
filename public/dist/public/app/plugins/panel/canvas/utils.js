import { isNumber, isString } from 'lodash';
import { AppEvents, getFieldDisplayName, PluginState } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { hasAlphaPanels } from 'app/core/config';
import { defaultElementItems, advancedElementItems, canvasElementRegistry, } from 'app/features/canvas';
import { notFoundItem } from 'app/features/canvas/elements/notFound';
import { ElementState } from 'app/features/canvas/runtime/element';
import { FrameState } from 'app/features/canvas/runtime/frame';
export function doSelect(scene, element) {
    try {
        let selection = { targets: [] };
        if (element instanceof FrameState) {
            const targetElements = [];
            targetElements.push(element === null || element === void 0 ? void 0 : element.div);
            selection.targets = targetElements;
            selection.frame = element;
            scene.select(selection);
        }
        else {
            scene.currentLayer = element.parent;
            selection.targets = [element === null || element === void 0 ? void 0 : element.div];
            scene.select(selection);
        }
    }
    catch (error) {
        appEvents.emit(AppEvents.alertError, ['Unable to select element, try selecting element in panel instead']);
    }
}
export function getElementTypes(shouldShowAdvancedTypes, current) {
    if (shouldShowAdvancedTypes) {
        return getElementTypesOptions([...defaultElementItems, ...advancedElementItems], current);
    }
    return getElementTypesOptions([...defaultElementItems], current);
}
export function getElementTypesOptions(items, current) {
    const selectables = { options: [], current: [] };
    const alpha = [];
    for (const item of items) {
        const option = { label: item.name, value: item.id, description: item.description };
        if (item.state === PluginState.alpha) {
            if (!hasAlphaPanels) {
                continue;
            }
            option.label = `${item.name} (Alpha)`;
            alpha.push(option);
        }
        else {
            selectables.options.push(option);
        }
        if (item.id === current) {
            selectables.current.push(option);
        }
    }
    for (const a of alpha) {
        selectables.options.push(a);
    }
    return selectables;
}
export function onAddItem(sel, rootLayer, anchorPoint) {
    var _a;
    const newItem = (_a = canvasElementRegistry.getIfExists(sel.value)) !== null && _a !== void 0 ? _a : notFoundItem;
    const newElementOptions = Object.assign(Object.assign({}, newItem.getNewOptions()), { type: newItem.id, name: '' });
    if (anchorPoint) {
        newElementOptions.placement = Object.assign(Object.assign({}, newElementOptions.placement), { top: anchorPoint.y, left: anchorPoint.x });
    }
    if (newItem.defaultSize) {
        newElementOptions.placement = Object.assign(Object.assign({}, newElementOptions.placement), newItem.defaultSize);
    }
    if (rootLayer) {
        const newElement = new ElementState(newItem, newElementOptions, rootLayer);
        newElement.updateData(rootLayer.scene.context);
        rootLayer.elements.push(newElement);
        rootLayer.scene.save();
        rootLayer.reinitializeMoveable();
        setTimeout(() => doSelect(rootLayer.scene, newElement));
    }
}
export function getDataLinks(ctx, cfg, textData) {
    const panelData = ctx.getPanelData();
    const frames = panelData === null || panelData === void 0 ? void 0 : panelData.series;
    const links = [];
    const linkLookup = new Set();
    frames === null || frames === void 0 ? void 0 : frames.forEach((frame) => {
        var _a;
        const visibleFields = frame.fields.filter((field) => { var _a, _b; return !Boolean((_b = (_a = field.config.custom) === null || _a === void 0 ? void 0 : _a.hideFrom) === null || _b === void 0 ? void 0 : _b.tooltip); });
        if (((_a = cfg.text) === null || _a === void 0 ? void 0 : _a.field) && visibleFields.some((f) => { var _a; return getFieldDisplayName(f, frame) === ((_a = cfg.text) === null || _a === void 0 ? void 0 : _a.field); })) {
            const field = visibleFields.filter((field) => { var _a; return getFieldDisplayName(field, frame) === ((_a = cfg.text) === null || _a === void 0 ? void 0 : _a.field); })[0];
            if (field === null || field === void 0 ? void 0 : field.getLinks) {
                const disp = field.display ? field.display(textData) : { text: `${textData}`, numeric: +textData };
                field.getLinks({ calculatedValue: disp }).forEach((link) => {
                    const key = `${link.title}/${link.href}`;
                    if (!linkLookup.has(key)) {
                        links.push(link);
                        linkLookup.add(key);
                    }
                });
            }
        }
    });
    return links;
}
export function isConnectionSource(element) {
    return element.options.connections && element.options.connections.length > 0;
}
export function isConnectionTarget(element, sceneByName) {
    const connections = getConnections(sceneByName);
    return connections.some((connection) => connection.target === element);
}
export function getConnections(sceneByName) {
    const connections = [];
    for (let v of sceneByName.values()) {
        if (v.options.connections) {
            v.options.connections.forEach((c, index) => {
                // @TODO Remove after v10.x
                if (isString(c.color)) {
                    c.color = { fixed: c.color };
                }
                if (isNumber(c.size)) {
                    c.size = { fixed: 2, min: 1, max: 10 };
                }
                const target = c.targetName ? sceneByName.get(c.targetName) : v.parent;
                if (target) {
                    connections.push({
                        index,
                        source: v,
                        target,
                        info: c,
                    });
                }
            });
        }
    }
    return connections;
}
export function getConnectionsByTarget(element, scene) {
    return scene.connections.state.filter((connection) => connection.target === element);
}
export function updateConnectionsForSource(element, scene) {
    const targetConnections = getConnectionsByTarget(element, scene);
    targetConnections.forEach((connection) => {
        var _a, _b;
        const sourceConnections = (_b = (_a = connection.source.options.connections) === null || _a === void 0 ? void 0 : _a.splice(0)) !== null && _b !== void 0 ? _b : [];
        const connections = sourceConnections.filter((con) => con.targetName !== element.getName());
        connection.source.onChange(Object.assign(Object.assign({}, connection.source.options), { connections }));
    });
}
//# sourceMappingURL=utils.js.map