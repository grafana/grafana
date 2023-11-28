import { __awaiter } from "tslib";
import { cloneDeep, isFunction } from 'lodash';
import { config } from '@grafana/runtime';
import { loadScriptIntoSandbox } from './code_loader';
import { forbiddenElements } from './constants';
import { logWarning, unboxRegexesFromMembraneProxy } from './utils';
const generalDistortionMap = new Map();
const monitorOnly = Boolean(config.featureToggles.frontendSandboxMonitorOnly);
const SANDBOX_LIVE_API_PATCHED = Symbol.for('@SANDBOX_LIVE_API_PATCHED');
export function getGeneralSandboxDistortionMap() {
    if (generalDistortionMap.size === 0) {
        // initialize the distortion map
        distortIframeAttributes(generalDistortionMap);
        distortConsole(generalDistortionMap);
        distortAlert(generalDistortionMap);
        distortAppend(generalDistortionMap);
        distortInsert(generalDistortionMap);
        distortInnerHTML(generalDistortionMap);
        distortCreateElement(generalDistortionMap);
        distortWorkers(generalDistortionMap);
        distortDocument(generalDistortionMap);
        distortMonacoEditor(generalDistortionMap);
        distortPostMessage(generalDistortionMap);
    }
    return generalDistortionMap;
}
function failToSet(originalAttrOrMethod, meta) {
    logWarning(`Plugin ${meta.id} tried to set a sandboxed property`, {
        pluginId: meta.id,
        attrOrMethod: String(originalAttrOrMethod),
        entity: 'window',
    });
    if (monitorOnly) {
        return originalAttrOrMethod;
    }
    return () => {
        throw new Error('Plugins are not allowed to set sandboxed properties');
    };
}
// sets distortion to protect iframe elements
function distortIframeAttributes(distortions) {
    const iframeHtmlForbiddenProperties = ['contentDocument', 'contentWindow', 'src', 'srcdoc', 'srcObject', 'srcset'];
    for (const property of iframeHtmlForbiddenProperties) {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, property);
        if (descriptor) {
            function fail(originalAttrOrMethod, meta) {
                const pluginId = meta.id;
                logWarning(`Plugin ${pluginId} tried to access iframe.${property}`, {
                    pluginId,
                    attrOrMethod: property,
                    entity: 'iframe',
                });
                if (monitorOnly) {
                    return originalAttrOrMethod;
                }
                return () => {
                    throw new Error('iframe.' + property + ' is not allowed in sandboxed plugins');
                };
            }
            if (descriptor.value) {
                distortions.set(descriptor.value, fail);
            }
            if (descriptor.set) {
                distortions.set(descriptor.set, fail);
            }
            if (descriptor.get) {
                distortions.set(descriptor.get, fail);
            }
        }
    }
}
// set distortions to always prefix any usage of console
function distortConsole(distortions) {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'console');
    if (descriptor === null || descriptor === void 0 ? void 0 : descriptor.value) {
        function getSandboxConsole(originalAttrOrMethod, meta) {
            const pluginId = meta.id;
            // we don't monitor the console because we expect a high volume of calls
            if (monitorOnly) {
                return originalAttrOrMethod;
            }
            function sandboxLog(...args) {
                console.log(`[plugin ${pluginId}]`, ...args);
            }
            return {
                log: sandboxLog,
                warn: sandboxLog,
                error: sandboxLog,
                info: sandboxLog,
                debug: sandboxLog,
                table: sandboxLog,
            };
        }
        distortions.set(descriptor.value, getSandboxConsole);
    }
    if (descriptor === null || descriptor === void 0 ? void 0 : descriptor.set) {
        distortions.set(descriptor.set, failToSet);
    }
}
// set distortions to alert to always output to the console
function distortAlert(distortions) {
    function getAlertDistortion(originalAttrOrMethod, meta) {
        const pluginId = meta.id;
        logWarning(`Plugin ${pluginId} accessed window.alert`, {
            pluginId,
            attrOrMethod: 'alert',
            entity: 'window',
        });
        if (monitorOnly) {
            return originalAttrOrMethod;
        }
        return function (...args) {
            console.log(`[plugin ${pluginId}]`, ...args);
        };
    }
    const descriptor = Object.getOwnPropertyDescriptor(window, 'alert');
    if (descriptor === null || descriptor === void 0 ? void 0 : descriptor.value) {
        distortions.set(descriptor.value, getAlertDistortion);
    }
    if (descriptor === null || descriptor === void 0 ? void 0 : descriptor.set) {
        distortions.set(descriptor.set, failToSet);
    }
}
function distortInnerHTML(distortions) {
    function getInnerHTMLDistortion(originalMethod, meta) {
        const pluginId = meta.id;
        return function innerHTMLDistortion(...args) {
            for (const arg of args) {
                const lowerCase = (arg === null || arg === void 0 ? void 0 : arg.toLowerCase()) || '';
                for (const forbiddenElement of forbiddenElements) {
                    if (lowerCase.includes('<' + forbiddenElement)) {
                        logWarning(`Plugin ${pluginId} tried to set ${forbiddenElement} in innerHTML`, {
                            pluginId,
                            attrOrMethod: 'innerHTML',
                            param: forbiddenElement,
                            entity: 'HTMLElement',
                        });
                        if (monitorOnly) {
                            continue;
                        }
                        throw new Error('<' + forbiddenElement + '> is not allowed in sandboxed plugins');
                    }
                }
            }
            if (isFunction(originalMethod)) {
                originalMethod.apply(this, args);
            }
        };
    }
    const descriptors = [
        Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML'),
        Object.getOwnPropertyDescriptor(Element.prototype, 'outerHTML'),
        Object.getOwnPropertyDescriptor(Element.prototype, 'insertAdjacentHTML'),
        Object.getOwnPropertyDescriptor(DOMParser.prototype, 'parseFromString'),
    ];
    for (const descriptor of descriptors) {
        if (descriptor === null || descriptor === void 0 ? void 0 : descriptor.set) {
            distortions.set(descriptor.set, getInnerHTMLDistortion);
        }
        if (descriptor === null || descriptor === void 0 ? void 0 : descriptor.value) {
            distortions.set(descriptor.value, getInnerHTMLDistortion);
        }
    }
}
function distortCreateElement(distortions) {
    function getCreateElementDistortion(originalMethod, meta) {
        const pluginId = meta.id;
        return function createElementDistortion(arg, options) {
            if (arg && forbiddenElements.includes(arg)) {
                logWarning(`Plugin ${pluginId} tried to create ${arg}`, {
                    pluginId,
                    attrOrMethod: 'createElement',
                    param: arg,
                    entity: 'document',
                });
                if (!monitorOnly) {
                    return document.createDocumentFragment();
                }
            }
            if (isFunction(originalMethod)) {
                return originalMethod.apply(this, [arg, options]);
            }
        };
    }
    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'createElement');
    if (descriptor === null || descriptor === void 0 ? void 0 : descriptor.value) {
        distortions.set(descriptor.value, getCreateElementDistortion);
    }
}
function distortInsert(distortions) {
    function getInsertDistortion(originalMethod, meta) {
        const pluginId = meta.id;
        return function insertChildDistortion(node, ref) {
            var _a;
            const nodeType = ((_a = node === null || node === void 0 ? void 0 : node.nodeName) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
            if (node && forbiddenElements.includes(nodeType)) {
                logWarning(`Plugin ${pluginId} tried to insert ${nodeType}`, {
                    pluginId,
                    attrOrMethod: 'insertChild',
                    param: nodeType,
                    entity: 'HTMLElement',
                });
                if (!monitorOnly) {
                    return document.createDocumentFragment();
                }
            }
            if (isFunction(originalMethod)) {
                return originalMethod.call(this, node, ref);
            }
        };
    }
    function getinsertAdjacentElementDistortion(originalMethod, meta) {
        const pluginId = meta.id;
        return function insertAdjacentElementDistortion(position, node) {
            var _a;
            const nodeType = ((_a = node === null || node === void 0 ? void 0 : node.nodeName) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
            if (node && forbiddenElements.includes(nodeType)) {
                logWarning(`Plugin ${pluginId} tried to insert ${nodeType}`, {
                    pluginId,
                    attrOrMethod: 'insertAdjacentElement',
                    param: nodeType,
                    entity: 'HTMLElement',
                });
                if (!monitorOnly) {
                    return document.createDocumentFragment();
                }
            }
            if (isFunction(originalMethod)) {
                return originalMethod.call(this, position, node);
            }
        };
    }
    const descriptors = [
        Object.getOwnPropertyDescriptor(Node.prototype, 'insertBefore'),
        Object.getOwnPropertyDescriptor(Node.prototype, 'replaceChild'),
    ];
    for (const descriptor of descriptors) {
        if (descriptor === null || descriptor === void 0 ? void 0 : descriptor.value) {
            distortions.set(descriptor.set, getInsertDistortion);
        }
    }
    const descriptorAdjacent = Object.getOwnPropertyDescriptor(Element.prototype, 'insertAdjacentElement');
    if (descriptorAdjacent === null || descriptorAdjacent === void 0 ? void 0 : descriptorAdjacent.value) {
        distortions.set(descriptorAdjacent.set, getinsertAdjacentElementDistortion);
    }
}
// set distortions to append elements to the document
function distortAppend(distortions) {
    // append accepts an array of nodes to append https://developer.mozilla.org/en-US/docs/Web/API/Node/append
    function getAppendDistortion(originalMethod, meta) {
        const pluginId = meta.id;
        return function appendDistortion(...args) {
            var _a;
            let acceptedNodes = args;
            const filteredAcceptedNodes = args === null || args === void 0 ? void 0 : args.filter((node) => !forbiddenElements.includes(node.nodeName.toLowerCase()));
            if (!monitorOnly) {
                acceptedNodes = filteredAcceptedNodes;
            }
            if (acceptedNodes.length !== filteredAcceptedNodes.length) {
                logWarning(`Plugin ${pluginId} tried to append fobiddenElements`, {
                    pluginId,
                    attrOrMethod: 'append',
                    param: ((_a = args === null || args === void 0 ? void 0 : args.filter((node) => forbiddenElements.includes(node.nodeName.toLowerCase()))) === null || _a === void 0 ? void 0 : _a.join(',')) || '',
                    entity: 'HTMLElement',
                });
            }
            if (isFunction(originalMethod)) {
                originalMethod.apply(this, acceptedNodes);
            }
            // https://developer.mozilla.org/en-US/docs/Web/API/Element/append#return_value
            return undefined;
        };
    }
    // appendChild accepts a single node to add https://developer.mozilla.org/en-US/docs/Web/API/Node/appendChild
    function getAppendChildDistortion(originalMethod, meta, sandboxEnv) {
        const pluginId = meta.id;
        return function appendChildDistortion(arg) {
            var _a;
            const nodeType = ((_a = arg === null || arg === void 0 ? void 0 : arg.nodeName) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
            if (arg && forbiddenElements.includes(nodeType)) {
                logWarning(`Plugin ${pluginId} tried to append ${nodeType}`, {
                    pluginId,
                    attrOrMethod: 'appendChild',
                    param: nodeType,
                    entity: 'HTMLElement',
                });
                if (!monitorOnly) {
                    return document.createDocumentFragment();
                }
            }
            // if the node is a script, load it into the sandbox
            // this allows webpack chunks to be loaded into the sandbox
            // loadScriptIntoSandbox has restrictions on what scripts can be loaded
            if (sandboxEnv && arg && nodeType === 'script' && arg instanceof HTMLScriptElement) {
                loadScriptIntoSandbox(arg.src, meta, sandboxEnv)
                    .then(() => {
                    var _a;
                    (_a = arg.onload) === null || _a === void 0 ? void 0 : _a.call(arg, new Event('load'));
                })
                    .catch((err) => {
                    var _a;
                    (_a = arg.onerror) === null || _a === void 0 ? void 0 : _a.call(arg, new ErrorEvent('error', { error: err }));
                });
                return undefined;
            }
            if (isFunction(originalMethod)) {
                return originalMethod.call(this, arg);
            }
        };
    }
    const descriptors = [
        Object.getOwnPropertyDescriptor(Element.prototype, 'append'),
        Object.getOwnPropertyDescriptor(Element.prototype, 'prepend'),
        Object.getOwnPropertyDescriptor(Element.prototype, 'after'),
        Object.getOwnPropertyDescriptor(Element.prototype, 'before'),
        Object.getOwnPropertyDescriptor(Document.prototype, 'append'),
        Object.getOwnPropertyDescriptor(Document.prototype, 'prepend'),
    ];
    for (const descriptor of descriptors) {
        if (descriptor === null || descriptor === void 0 ? void 0 : descriptor.value) {
            distortions.set(descriptor.value, getAppendDistortion);
        }
    }
    const appendChildDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'appendChild');
    if (appendChildDescriptor === null || appendChildDescriptor === void 0 ? void 0 : appendChildDescriptor.value) {
        distortions.set(appendChildDescriptor.value, getAppendChildDistortion);
    }
}
// this is not a distortion for security reasons but to make plugins using web workers work correctly.
function distortWorkers(distortions) {
    const descriptor = Object.getOwnPropertyDescriptor(Worker.prototype, 'postMessage');
    function getPostMessageDistortion(originalMethod) {
        return function postMessageDistortion(...args) {
            // proxies can't be serialized by postMessage algorithm
            // the only way to pass it through is to send a cloned version
            // objects passed to postMessage should be clonable
            try {
                const newArgs = cloneDeep(args);
                if (isFunction(originalMethod)) {
                    originalMethod.apply(this, newArgs);
                }
            }
            catch (e) {
                throw new Error('postMessage arguments are invalid objects');
            }
        };
    }
    if (descriptor === null || descriptor === void 0 ? void 0 : descriptor.value) {
        distortions.set(descriptor.value, getPostMessageDistortion);
    }
}
// this is not a distortion for security reasons but to make plugins using document.defaultView work correctly.
function distortDocument(distortions) {
    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'defaultView');
    if (descriptor === null || descriptor === void 0 ? void 0 : descriptor.get) {
        distortions.set(descriptor.get, () => {
            return () => {
                return window;
            };
        });
    }
    const documentForbiddenMethods = ['write'];
    for (const method of documentForbiddenMethods) {
        const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, method);
        if (descriptor === null || descriptor === void 0 ? void 0 : descriptor.set) {
            distortions.set(descriptor.set, failToSet);
        }
        if (descriptor === null || descriptor === void 0 ? void 0 : descriptor.value) {
            distortions.set(descriptor.value, failToSet);
        }
    }
}
function distortMonacoEditor(distortions) {
    return __awaiter(this, void 0, void 0, function* () {
        // We rely on `monaco` being instanciated inside `window.monaco`.
        // this is the same object passed down to plugins using monaco editor for their editors
        // this `window.monaco` is an instance of monaco but not the same as if we
        // import `monaco-editor` directly in this file.
        // Short of abusing the `window.monaco` object we would have to modify grafana-ui to export
        // the monaco instance directly in the ReactMonacoEditor component
        const monacoEditor = Reflect.get(window, 'monaco');
        // do not double patch
        if (!monacoEditor || Object.hasOwn(monacoEditor, SANDBOX_LIVE_API_PATCHED)) {
            return;
        }
        const originalSetMonarchTokensProvider = monacoEditor.languages.setMonarchTokensProvider;
        // NOTE: this function in particular is called only once per intialized custom language inside a plugin which is a
        // rare ocurrance but if not patched it'll break the syntax highlighting for the custom language.
        function getSetMonarchTokensProvider() {
            return function (...args) {
                if (args.length !== 2) {
                    return originalSetMonarchTokensProvider.apply(monacoEditor, args);
                }
                return originalSetMonarchTokensProvider.call(monacoEditor, args[0], unboxRegexesFromMembraneProxy(args[1]));
            };
        }
        distortions.set(monacoEditor.languages.setMonarchTokensProvider, getSetMonarchTokensProvider);
        Reflect.set(monacoEditor, SANDBOX_LIVE_API_PATCHED, {});
    });
}
function distortPostMessage(distortions) {
    return __awaiter(this, void 0, void 0, function* () {
        const descriptor = Object.getOwnPropertyDescriptor(window, 'postMessage');
        function getPostMessageDistortion(originalMethod) {
            return function postMessageDistortion(...args) {
                // proxies can't be serialized by postMessage algorithm
                // the only way to pass it through is to send a cloned version
                // objects passed to postMessage should be clonable
                try {
                    const newArgs = cloneDeep(args);
                    if (isFunction(originalMethod)) {
                        originalMethod.apply(this, newArgs);
                    }
                }
                catch (e) {
                    throw new Error('postMessage arguments are invalid objects');
                }
            };
        }
        if (descriptor === null || descriptor === void 0 ? void 0 : descriptor.value) {
            distortions.set(descriptor.value, getPostMessageDistortion);
        }
    });
}
/**
 * "Live" APIs are APIs that can only be distorted at runtime.
 * This could be because the objects we want to patch only become available after specific states are reached,
 * or because the libraries we want to patch are lazy-loaded and we don't have access to their definitions.
 * We put here only distortions that can't be static because they are dynamicly loaded
 */
export function distortLiveApis(originalValue) {
    distortMonacoEditor(generalDistortionMap);
    // This distorts the `history.replace` function in react-router-dom.
    // constructed for each browser history and is only accessible within the react context.
    // Note that this distortion does not affect `String.prototype.replace` calls.
    // because they don't go through distortions
    if (originalValue instanceof Function &&
        originalValue.name === 'replace' &&
        originalValue.prototype.constructor.length === 2) {
        return function replace(...args) {
            // validate history.replace signature further
            if (args && args[0] && typeof args[0] === 'string' && args[1] && !(args[1] instanceof Function)) {
                const newArgs = cloneDeep(args);
                return Reflect.apply(originalValue, this, newArgs);
            }
            return Reflect.apply(originalValue, this, args);
        };
    }
    return;
}
//# sourceMappingURL=distortion_map.js.map