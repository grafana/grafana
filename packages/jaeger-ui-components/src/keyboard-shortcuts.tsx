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

import Combokeys from 'combokeys';
import * as React from 'react';

import keyboardMappings from './keyboard-mappings';

export type CombokeysHandler =
  | (() => void)
  | ((event: React.KeyboardEvent<any>) => void)
  | ((event: React.KeyboardEvent<any>, s: string) => void);

export type ShortcutCallbacks = {
  [name: string]: CombokeysHandler;
};

let instance: Combokeys | undefined;

function getInstance(): Combokeys {
  if (instance) {
    return instance;
  }
  const local = new Combokeys(document.body);
  instance = local;
  return local;
}

export function merge(callbacks: ShortcutCallbacks) {
  const inst = getInstance();
  Object.keys(callbacks).forEach((name) => {
    const keysHandler = callbacks[name];
    if (keysHandler) {
      inst.bind(keyboardMappings[name].binding, keysHandler);
    }
  });
}

export function reset() {
  const combokeys = getInstance();
  combokeys.reset();
}
