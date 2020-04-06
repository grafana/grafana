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

import DraggableManager, { DraggableBounds, DraggingUpdate } from '..';
import { TNil } from '../../../types';

import './RegionDemo.css';

type TUpdate = {
  regionCursor?: number | null;
  regionDragging?: number[] | null;
};

type RegionDemoProps = {
  regionCursor: number | TNil;
  regionDragging: [number, number] | TNil;
  updateState: (update: TUpdate) => void;
};

export default class RegionDemo extends React.PureComponent<RegionDemoProps> {
  _dragManager: DraggableManager;

  _realmElm: HTMLElement | TNil;

  constructor(props: RegionDemoProps) {
    super(props);

    this._realmElm = null;

    this._dragManager = new DraggableManager({
      getBounds: this._getDraggingBounds,
      onDragEnd: this._handleDragEnd,
      onDragMove: this._handleDragUpdate,
      onDragStart: this._handleDragUpdate,
      onMouseMove: this._handleMouseMove,
      onMouseLeave: this._handleMouseLeave,
    });
  }

  _setRealm = (elm: HTMLElement | TNil) => {
    this._realmElm = elm;
  };

  _getDraggingBounds = (): DraggableBounds => {
    if (!this._realmElm) {
      throw new Error('invalid state');
    }
    const { left: clientXLeft, width } = this._realmElm.getBoundingClientRect();
    return {
      clientXLeft,
      width,
      maxValue: 1,
      minValue: 0,
    };
  };

  _handleMouseMove = ({ value }: DraggingUpdate) => {
    this.props.updateState({ regionCursor: value });
  };

  _handleMouseLeave = () => {
    this.props.updateState({ regionCursor: null });
  };

  _handleDragUpdate = ({ value }: DraggingUpdate) => {
    const { regionDragging: prevRegionDragging } = this.props;
    let regionDragging;
    if (prevRegionDragging) {
      regionDragging = [prevRegionDragging[0], value];
    } else {
      regionDragging = [value, value];
    }
    this.props.updateState({ regionDragging });
  };

  _handleDragEnd = ({ value }: DraggingUpdate) => {
    this.props.updateState({ regionDragging: null, regionCursor: value });
  };

  render() {
    const { regionCursor, regionDragging } = this.props;
    let cursorElm;
    let regionElm;
    if (regionDragging) {
      const [a, b] = regionDragging;
      const [left, right] = a < b ? [a, 1 - b] : [b, 1 - a];
      const regionStyle = { left: `${left * 100}%`, right: `${right * 100}%` };
      regionElm = <div className="RegionDemo--region" style={regionStyle} />;
    } else if (regionCursor) {
      const cursorStyle = { left: `${regionCursor * 100}%` };
      cursorElm = <div className="RegionDemo--regionCursor" style={cursorStyle} />;
    }
    return (
      <div
        aria-hidden
        className="RegionDemo--realm"
        onMouseDown={this._dragManager.handleMouseDown}
        onMouseMove={this._dragManager.handleMouseMove}
        onMouseLeave={this._dragManager.handleMouseMove}
        ref={this._setRealm}
      >
        {regionElm}
        {cursorElm}
      </div>
    );
  }
}
