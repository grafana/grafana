// Copyright (c) 2019 Uber Technologies, Inc.
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

// For jest
declare type TestGlobal = {
  location: Location;
};
declare const global: TestGlobal;

declare interface Window {
  // eslint-disable-line @typescript-eslint/interface-name-prefix
  // For setting the site-prefix
  __webpack_public_path__: string; // eslint-disable-line camelcase
  // For getting ui config
  getJaegerUiConfig?: () => Record<string, any>;
}

// For inlined envvars
declare const process: {
  env: {
    NODE_ENV: string;
    REACT_APP_GA_DEBUG?: string;
    REACT_APP_VSN_STATE?: string;
  };
};

declare module 'combokeys' {
  export default class Combokeys {
    constructor(element: HTMLElement);
    bind: (binding: string | string[], handler: CombokeysHandler) => void;
    reset: () => void;
  }
}

declare module 'react-helmet';
declare module 'json-markup';
declare module 'react-vis-force';
declare module 'tween-functions';
