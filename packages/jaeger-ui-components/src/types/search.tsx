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

import { TNil } from '.';

export type SearchQuery = {
  end: number | string;
  limit: number | string;
  lookback: string;
  maxDuration: null | string;
  minDuration: null | string;
  operation: string | TNil;
  service: string;
  start: number | string;
  tags: string | TNil;
};

/**
 * Type used to summarize traces for the search page.
 */
export type TraceSummary = {
  /**
   * Duration of trace in milliseconds.
   */
  duration: number;
  /**
   * Start time of trace in milliseconds.
   */
  timestamp: number;
  traceName: string;
  traceID: string;
  numberOfErredSpans: number;
  numberOfSpans: number;
  services: Array<{ name: string; numberOfSpans: number }>;
};

export type TraceSummaries = {
  /**
   * Duration of longest trace in `traces` in milliseconds.
   */
  maxDuration: number;
  traces: TraceSummary[];
};
