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

import { DraggableBounds, DraggingUpdate } from '..';
import DraggableManager from '../DraggableManager';
import TNil from '../../../types/TNil';

import './DividerDemo.css';

type DividerDemoProps = {
  position: number;
  updateState: (update: { dividerPosition: number }) => void;
};

export default class DividerDemo extends React.PureComponent<DividerDemoProps> {
  _dragManager: DraggableManager;

  _realmElm: HTMLElement | TNil;

  constructor(props: DividerDemoProps) {
    super(props);

    this._realmElm = null;

    this._dragManager = new DraggableManager({
      getBounds: this._getDraggingBounds,
      onDragEnd: this._handleDragEvent,
      onDragMove: this._handleDragEvent,
      onDragStart: this._handleDragEvent,
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
      maxValue: 0.98,
      minValue: 0.02,
    };
  };

  _handleDragEvent = ({ value }: DraggingUpdate) => {
    this.props.updateState({ dividerPosition: value });
  };

  render() {
    const { position } = this.props;
    const style = { left: `${position * 100}%` };
    return (
      <div className="DividerDemo--realm" ref={this._setRealm}>
        <div
          aria-hidden
          className="DividerDemo--divider"
          onMouseDown={this._dragManager.handleMouseDown}
          style={style}
        />
      </div>
    );
  }
}
