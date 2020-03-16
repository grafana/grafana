// Copyright (c) 2017 Uber Technologies, Inc.
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

/* eslint-disable no-console, import/first */

jest.mock('./process-deprecation');

import getConfig, { getConfigValue } from './get-config';
import processDeprecation from './process-deprecation';
import defaultConfig, { deprecations } from '../../constants/default-config';

describe('getConfig()', () => {
  const warnFn = jest.fn();
  let oldWarn;

  beforeAll(() => {
    oldWarn = console.warn;
    console.warn = warnFn;
  });

  beforeEach(() => {
    warnFn.mockClear();
  });

  afterAll(() => {
    console.warn = oldWarn;
  });

  describe('`window.getJaegerUiConfig` is not a function', () => {
    beforeAll(() => {
      window.getJaegerUiConfig = undefined;
    });

    it('warns once', () => {
      getConfig();
      expect(warnFn.mock.calls.length).toBe(1);
      getConfig();
      expect(warnFn.mock.calls.length).toBe(1);
    });

    it('returns the default config', () => {
      expect(getConfig()).toEqual(defaultConfig);
    });
  });

  describe('`window.getJaegerUiConfig` is a function', () => {
    let embedded;
    let getJaegerUiConfig;

    beforeEach(() => {
      embedded = {};
      getJaegerUiConfig = jest.fn(() => embedded);
      window.getJaegerUiConfig = getJaegerUiConfig;
    });

    it('returns the default config when the embedded config is `null`', () => {
      embedded = null;
      expect(getConfig()).toEqual(defaultConfig);
    });

    it('merges the defaultConfig with the embedded config ', () => {
      embedded = { novel: 'prop' };
      expect(getConfig()).toEqual({ ...defaultConfig, ...embedded });
    });

    describe('overwriting precedence and merging', () => {
      describe('fields not in __mergeFields', () => {
        it('gives precedence to the embedded config', () => {
          const mergeFields = new Set(defaultConfig.__mergeFields);
          const keys = Object.keys(defaultConfig).filter(k => !mergeFields.has(k));
          embedded = {};
          keys.forEach(key => {
            embedded[key] = key;
          });
          expect(getConfig()).toEqual({ ...defaultConfig, ...embedded });
        });
      });

      describe('fields in __mergeFields', () => {
        it('gives precedence to non-objects in embedded', () => {
          embedded = {};
          defaultConfig.__mergeFields.forEach((k, i) => {
            embedded[k] = i ? true : null;
          });
          expect(getConfig()).toEqual({ ...defaultConfig, ...embedded });
        });

        it('merges object values', () => {
          embedded = {};
          const key = defaultConfig.__mergeFields[0];
          if (!key) {
            throw new Error('invalid __mergeFields');
          }
          embedded[key] = { a: true, b: false };
          const expected = { ...defaultConfig, ...embedded };
          expected[key] = { ...defaultConfig[key], ...embedded[key] };
          expect(getConfig()).toEqual(expected);
        });
      });
    });

    it('processes deprecations every time `getConfig` is invoked', () => {
      processDeprecation.mockClear();
      getConfig();
      expect(processDeprecation.mock.calls.length).toBe(deprecations.length);
      getConfig();
      expect(processDeprecation.mock.calls.length).toBe(2 * deprecations.length);
    });
  });
});

describe('getConfigValue(...)', () => {
  it('returns embedded paths, e.g. "a.b"', () => {
    expect(getConfigValue('dependencies.menuEnabled')).toBe(true);
  });

  it('handles non-existent paths"', () => {
    expect(getConfigValue('not.a.real.path')).toBe(undefined);
  });
});
