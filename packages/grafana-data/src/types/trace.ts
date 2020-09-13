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

/**
 * All timestamps are in microseconds
 */

// TODO: Everett Tech Debt: Fix KeyValuePair types
export type TraceKeyValuePair = {
  key: string;
  type?: string;
  value: any;
};

export type TraceLink = {
  url: string;
  text: string;
};

export type TraceLog = {
  timestamp: number;
  fields: TraceKeyValuePair[];
};

export type TraceProcess = {
  serviceName: string;
  tags: TraceKeyValuePair[];
};

export type TraceSpanReference = {
  refType: 'CHILD_OF' | 'FOLLOWS_FROM';
  // eslint-disable-next-line no-use-before-define
  span?: TraceSpan | null | undefined;
  spanID: string;
  traceID: string;
};

export type TraceSpanData = {
  spanID: string;
  traceID: string;
  processID: string;
  operationName: string;
  startTime: number;
  duration: number;
  logs: TraceLog[];
  tags?: TraceKeyValuePair[];
  references?: TraceSpanReference[];
  warnings?: string[] | null;
  stackTraces?: string[];
  flags: number;
  errorIconColor?: string;
};

export type TraceSpan = TraceSpanData & {
  depth: number;
  hasChildren: boolean;
  process: TraceProcess;
  relativeStartTime: number;
  tags: NonNullable<TraceSpanData['tags']>;
  references: NonNullable<TraceSpanData['references']>;
  warnings: NonNullable<TraceSpanData['warnings']>;
  subsidiarilyReferencedBy: TraceSpanReference[];
};

export type TraceData = {
  processes: Record<string, TraceProcess>;
  traceID: string;
  warnings?: string[] | null;
};

export type Trace = TraceData & {
  duration: number;
  endTime: number;
  spans: TraceSpan[];
  startTime: number;
  traceName: string;
  services: Array<{ name: string; numberOfSpans: number }>;
};
