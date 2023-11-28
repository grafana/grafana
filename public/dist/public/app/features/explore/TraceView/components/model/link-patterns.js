// Copyright (c) 2017 The Jaeger Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { uniq as _uniq } from 'lodash';
import memoize from 'lru-memoize';
import { getConfigValue } from '../utils/config/get-config';
import { getParent } from './span';
const parameterRegExp = /#\{([^{}]*)\}/g;
function getParamNames(str) {
    const names = new Set();
    str.replace(parameterRegExp, (match, name) => {
        names.add(name);
        return match;
    });
    return Array.from(names);
}
function stringSupplant(str, encodeFn, map) {
    return str.replace(parameterRegExp, (_, name) => {
        const value = map[name];
        return value == null ? '' : encodeFn(value);
    });
}
export function processTemplate(template, encodeFn) {
    if (typeof template !== 'string') {
        /*
    
        // kept on ice until #123 is implemented:
        if (template && Array.isArray(template.parameters) && (typeof template.template === 'function')) {
          return template;
        }
    
        */
        throw new Error('Invalid template');
    }
    return {
        parameters: getParamNames(template),
        template: stringSupplant.bind(null, template, encodeFn),
    };
}
export function createTestFunction(entry) {
    if (typeof entry === 'string') {
        return (arg) => arg === entry;
    }
    if (Array.isArray(entry)) {
        return (arg) => entry.indexOf(arg) > -1;
    }
    /*
  
    // kept on ice until #123 is implemented:
    if (entry instanceof RegExp) {
      return (arg: any) => entry.test(arg);
    }
    if (typeof entry === 'function') {
      return entry;
    }
  
    */
    if (entry == null) {
        return () => true;
    }
    throw new Error(`Invalid value: ${entry}`);
}
const identity = (a) => a;
export function processLinkPattern(pattern) {
    try {
        const url = processTemplate(pattern.url, encodeURIComponent);
        const text = processTemplate(pattern.text, identity);
        return {
            object: pattern,
            type: createTestFunction(pattern.type),
            key: createTestFunction(pattern.key),
            value: createTestFunction(pattern.value),
            url,
            text,
            parameters: _uniq(url.parameters.concat(text.parameters)),
        };
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Ignoring invalid link pattern: ${error}`, pattern);
        return null;
    }
}
export function getParameterInArray(name, array) {
    if (array) {
        return array.find((entry) => entry.key === name);
    }
    return undefined;
}
export function getParameterInAncestor(name, span) {
    let currentSpan = span;
    while (currentSpan) {
        const result = getParameterInArray(name, currentSpan.tags) || getParameterInArray(name, currentSpan.process.tags);
        if (result) {
            return result;
        }
        currentSpan = getParent(currentSpan);
    }
    return undefined;
}
function callTemplate(template, data) {
    return template.template(data);
}
export function computeTraceLink(linkPatterns, trace) {
    const result = [];
    const validKeys = Object.keys(trace).filter((key) => typeof trace[key] === 'string' || trace[key] === 'number');
    linkPatterns === null || linkPatterns === void 0 ? void 0 : linkPatterns.filter((pattern) => pattern === null || pattern === void 0 ? void 0 : pattern.type('traces')).forEach((pattern) => {
        const parameterValues = {};
        const allParameters = pattern === null || pattern === void 0 ? void 0 : pattern.parameters.every((parameter) => {
            const key = parameter;
            if (validKeys.includes(key)) {
                // At this point is safe to access to trace object using parameter variable because
                // we validated parameter against validKeys, this implies that parameter a keyof Trace.
                parameterValues[parameter] = trace[key];
                return true;
            }
            return false;
        });
        if (allParameters) {
            result.push({
                url: callTemplate(pattern.url, parameterValues),
                text: callTemplate(pattern.text, parameterValues),
            });
        }
    });
    return result;
}
export function computeLinks(linkPatterns, span, items, itemIndex) {
    const item = items[itemIndex];
    let type = 'logs';
    const processTags = span.process.tags === items;
    if (processTags) {
        type = 'process';
    }
    const spanTags = span.tags === items;
    if (spanTags) {
        type = 'tags';
    }
    const result = [];
    linkPatterns.forEach((pattern) => {
        if (pattern.type(type) && pattern.key(item.key) && pattern.value(item.value)) {
            const parameterValues = {};
            const allParameters = pattern.parameters.every((parameter) => {
                let entry = getParameterInArray(parameter, items);
                if (!entry && !processTags) {
                    // do not look in ancestors for process tags because the same object may appear in different places in the hierarchy
                    // and the cache in getLinks uses that object as a key
                    entry = getParameterInAncestor(parameter, span);
                }
                if (entry) {
                    parameterValues[parameter] = entry.value;
                    return true;
                }
                // eslint-disable-next-line no-console
                console.warn(`Skipping link pattern, missing parameter ${parameter} for key ${item.key} in ${type}.`, pattern.object);
                return false;
            });
            if (allParameters) {
                result.push({
                    url: callTemplate(pattern.url, parameterValues),
                    text: callTemplate(pattern.text, parameterValues),
                });
            }
        }
    });
    return result;
}
export function createGetLinks(linkPatterns, cache) {
    return (span, items, itemIndex) => {
        if (linkPatterns.length === 0) {
            return [];
        }
        const item = items[itemIndex];
        let result = cache.get(item);
        if (!result) {
            result = computeLinks(linkPatterns, span, items, itemIndex);
            cache.set(item, result);
        }
        return result;
    };
}
const processedLinks = (getConfigValue('linkPatterns') || [])
    .map(processLinkPattern)
    .filter((link) => Boolean(link));
export const getTraceLinks = memoize(10)((trace) => {
    const result = [];
    if (!trace) {
        return result;
    }
    return computeTraceLink(processedLinks, trace);
});
export default createGetLinks(processedLinks, new WeakMap());
//# sourceMappingURL=link-patterns.js.map