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
import DraggableManager from '../DraggableManager';
import './DividerDemo.css';
export default class DividerDemo extends React.PureComponent {
    constructor(props) {
        super(props);
        this._setRealm = (elm) => {
            this._realmElm = elm;
        };
        this._getDraggingBounds = () => {
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
        this._handleDragEvent = ({ value }) => {
            this.props.updateState({ dividerPosition: value });
        };
        this._realmElm = null;
        this._dragManager = new DraggableManager({
            getBounds: this._getDraggingBounds,
            onDragEnd: this._handleDragEvent,
            onDragMove: this._handleDragEvent,
            onDragStart: this._handleDragEvent,
        });
    }
    render() {
        const { position } = this.props;
        const style = { left: `${position * 100}%` };
        return (React.createElement("div", { className: "DividerDemo--realm", ref: this._setRealm },
            React.createElement("div", { "aria-hidden": true, className: "DividerDemo--divider", onMouseDown: this._dragManager.handleMouseDown, style: style })));
    }
}
//# sourceMappingURL=DividerDemo.js.map