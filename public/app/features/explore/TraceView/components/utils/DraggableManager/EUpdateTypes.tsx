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

// // export default {
// const updateTypes = {
//   DRAG_END: 'DRAG_END',
//   DRAG_MOVE: 'DRAG_MOVE',
//   DRAG_START: 'DRAG_START',
//   MOUSE_ENTER: 'MOUSE_ENTER',
//   MOUSE_LEAVE: 'MOUSE_LEAVE',
//   MOUSE_MOVE: 'MOUSE_MOVE',
// };

// const typeUpdateTypes = updateTypes as { [K in keyof typeof updateTypes]: K };

enum EUpdateTypes {
  DragEnd = 'DragEnd',
  DragMove = 'DragMove',
  DragStart = 'DragStart',
  MouseEnter = 'MouseEnter',
  MouseLeave = 'MouseLeave',
  MouseMove = 'MouseMove',
}

export default EUpdateTypes;
