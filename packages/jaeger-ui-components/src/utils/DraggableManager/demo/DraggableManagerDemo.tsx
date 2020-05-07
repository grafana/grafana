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

import React from 'react';

import DividerDemo from './DividerDemo';
import RegionDemo from './RegionDemo';
import { TNil } from '../../../types';

import './DraggableManagerDemo.css';

export type DraggableManagerDemoState = {
  dividerPosition: number;
  regionCursor: number | TNil;
  regionDragging: [number, number] | TNil;
};

export default class DraggableManagerDemo extends React.PureComponent<{}, DraggableManagerDemoState> {
  state: DraggableManagerDemoState;

  constructor(props: {}) {
    super(props);
    this.state = {
      dividerPosition: 0.25,
      regionCursor: null,
      regionDragging: null,
    };
  }

  _updateState = (nextState: {}) => {
    this.setState(nextState);
  };

  render() {
    const { dividerPosition, regionCursor, regionDragging } = this.state;
    return (
      <div className="DraggableManagerDemo">
        <h1>DraggableManager demo</h1>
        <section className="DraggableManagerDemo--scenario">
          <h2>Dragging a Divider</h2>
          <p>Click and drag the gray divider in the colored area, below.</p>
          <p>Value: {dividerPosition.toFixed(3)}</p>
          <div className="DraggableManagerDemo--realm">
            <DividerDemo position={dividerPosition} updateState={this._updateState} />
          </div>
        </section>
        <section className="DraggableManagerDemo--scenario">
          <h2>Dragging a Sub-Region</h2>
          <p>Click and drag horizontally somewhere in the colored area, below.</p>
          <p>Value: {regionDragging && regionDragging.map(n => n.toFixed(3)).join(', ')}</p>
          <div className="DraggableManagerDemo--realm">
            <RegionDemo regionCursor={regionCursor} regionDragging={regionDragging} updateState={this._updateState} />
          </div>
        </section>
      </div>
    );
  }
}
