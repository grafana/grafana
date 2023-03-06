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

import { TNil } from './index';

export type ConfigMenuItem = {
  label: string;
  url: string;
  anchorTarget?: '_self' | '_blank' | '_parent' | '_top';
};

export type ConfigMenuGroup = {
  label: string;
  items: ConfigMenuItem[];
};

export type TScript = {
  text: string;
  type: 'inline';
};

export type LinkPatternsConfig = {
  type: 'process' | 'tags' | 'logs' | 'traces';
  key?: string;
  url: string;
  text: string;
};

export type Config = {
  archiveEnabled?: boolean;
  deepDependencies?: { menuEnabled?: boolean };
  dependencies?: { dagMaxServicesLen?: number; menuEnabled?: boolean };
  menu: Array<ConfigMenuGroup | ConfigMenuItem>;
  search?: { maxLookback: { label: string; value: string }; maxLimit: number };
  scripts?: TScript[];
  topTagPrefixes?: string[];
  tracking?: {
    cookieToDimension?: Array<{
      cookie: string;
      dimension: string;
    }>;
    gaID: string | TNil;
    trackErrors: boolean | TNil;
  };
  linkPatterns?: LinkPatternsConfig;
};
