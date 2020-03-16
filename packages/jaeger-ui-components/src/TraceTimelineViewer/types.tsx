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

import { TNil } from '../types';

interface ITimeCursorUpdate {
  cursor: number | TNil;
}

interface ITimeReframeUpdate {
  reframe: {
    anchor: number;
    shift: number;
  };
}

interface ITimeShiftEndUpdate {
  shiftEnd: number;
}

interface ITimeShiftStartUpdate {
  shiftStart: number;
}

export type TUpdateViewRangeTimeFunction = (start: number, end: number, trackSrc?: string) => void;

export type ViewRangeTimeUpdate = ITimeCursorUpdate | ITimeReframeUpdate | ITimeShiftEndUpdate | ITimeShiftStartUpdate;

export interface IViewRangeTime {
  current: [number, number];
  cursor?: number | TNil;
  reframe?: {
    anchor: number;
    shift: number;
  };
  shiftEnd?: number;
  shiftStart?: number;
}

export interface IViewRange {
  time: IViewRangeTime;
}
