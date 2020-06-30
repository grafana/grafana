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

import _uniq from 'lodash/uniq';
import memoize from 'lru-memoize';
import { getConfigValue } from '../utils/config/get-config';
import { getParent } from './span';
import { TNil } from '../types';
import { TraceSpan, TraceLink, TraceKeyValuePair, Trace } from '@grafana/data';

const parameterRegExp = /#\{([^{}]*)\}/g;

type ProcessedTemplate = {
  parameters: string[];
  template: (template: { [key: string]: any }) => string;
};

type ProcessedLinkPattern = {
  object: any;
  type: (link: string) => boolean;
  key: (link: string) => boolean;
  value: (value: any) => boolean;
  url: ProcessedTemplate;
  text: ProcessedTemplate;
  parameters: string[];
};

type TLinksRV = Array<{ url: string; text: string }>;

function getParamNames(str: string) {
  const names = new Set<string>();
  str.replace(parameterRegExp, (match, name) => {
    names.add(name);
    return match;
  });
  return Array.from(names);
}

function stringSupplant(str: string, encodeFn: (unencoded: any) => string, map: Record<string, any>) {
  return str.replace(parameterRegExp, (_, name) => {
    const value = map[name];
    return value == null ? '' : encodeFn(value);
  });
}

export function processTemplate(template: any, encodeFn: (unencoded: any) => string): ProcessedTemplate {
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

export function createTestFunction(entry: any) {
  if (typeof entry === 'string') {
    return (arg: any) => arg === entry;
  }
  if (Array.isArray(entry)) {
    return (arg: any) => entry.indexOf(arg) > -1;
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

const identity = (a: any): typeof a => a;

export function processLinkPattern(pattern: any): ProcessedLinkPattern | TNil {
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
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Ignoring invalid link pattern: ${error}`, pattern);
    return null;
  }
}

export function getParameterInArray(name: string, array: TraceKeyValuePair[]) {
  if (array) {
    return array.find(entry => entry.key === name);
  }
  return undefined;
}

export function getParameterInAncestor(name: string, span: TraceSpan) {
  let currentSpan: TraceSpan | TNil = span;
  while (currentSpan) {
    const result = getParameterInArray(name, currentSpan.tags) || getParameterInArray(name, currentSpan.process.tags);
    if (result) {
      return result;
    }
    currentSpan = getParent(currentSpan);
  }
  return undefined;
}

function callTemplate(template: ProcessedTemplate, data: any) {
  return template.template(data);
}

export function computeTraceLink(linkPatterns: ProcessedLinkPattern[], trace: Trace) {
  const result: TLinksRV = [];
  const validKeys = (Object.keys(trace) as Array<keyof Trace>).filter(
    key => typeof trace[key] === 'string' || trace[key] === 'number'
  );

  linkPatterns
    .filter(pattern => pattern.type('traces'))
    .forEach(pattern => {
      const parameterValues: Record<string, any> = {};
      const allParameters = pattern.parameters.every(parameter => {
        const key = parameter as keyof Trace;
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

export function computeLinks(
  linkPatterns: ProcessedLinkPattern[],
  span: TraceSpan,
  items: TraceKeyValuePair[],
  itemIndex: number
) {
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
  const result: Array<{ url: string; text: string }> = [];
  linkPatterns.forEach(pattern => {
    if (pattern.type(type) && pattern.key(item.key) && pattern.value(item.value)) {
      const parameterValues: Record<string, any> = {};
      const allParameters = pattern.parameters.every(parameter => {
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
        console.warn(
          `Skipping link pattern, missing parameter ${parameter} for key ${item.key} in ${type}.`,
          pattern.object
        );
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

export function createGetLinks(linkPatterns: ProcessedLinkPattern[], cache: WeakMap<TraceKeyValuePair, TraceLink[]>) {
  return (span: TraceSpan, items: TraceKeyValuePair[], itemIndex: number) => {
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

const processedLinks: ProcessedLinkPattern[] = (getConfigValue('linkPatterns') || [])
  .map(processLinkPattern)
  .filter(Boolean);

export const getTraceLinks: (trace: Trace | undefined) => TLinksRV = memoize(10)((trace: Trace | undefined) => {
  const result: TLinksRV = [];
  if (!trace) {
    return result;
  }
  return computeTraceLink(processedLinks, trace);
});

export default createGetLinks(processedLinks, new WeakMap());
