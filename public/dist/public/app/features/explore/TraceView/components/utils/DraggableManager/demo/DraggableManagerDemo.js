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
import './DraggableManagerDemo.css';
export default class DraggableManagerDemo extends React.PureComponent {
    constructor(props) {
        super(props);
        this._updateState = (nextState) => {
            this.setState(nextState);
        };
        this.state = {
            dividerPosition: 0.25,
            regionCursor: null,
            regionDragging: null,
        };
    }
    render() {
        const { dividerPosition, regionCursor, regionDragging } = this.state;
        return (React.createElement("div", { className: "DraggableManagerDemo" },
            React.createElement("h1", null, "DraggableManager demo"),
            React.createElement("section", { className: "DraggableManagerDemo--scenario" },
                React.createElement("h2", null, "Dragging a Divider"),
                React.createElement("p", null, "Click and drag the gray divider in the colored area, below."),
                React.createElement("p", null,
                    "Value: ",
                    dividerPosition.toFixed(3)),
                React.createElement("div", { className: "DraggableManagerDemo--realm" },
                    React.createElement(DividerDemo, { position: dividerPosition, updateState: this._updateState }))),
            React.createElement("section", { className: "DraggableManagerDemo--scenario" },
                React.createElement("h2", null, "Dragging a Sub-Region"),
                React.createElement("p", null, "Click and drag horizontally somewhere in the colored area, below."),
                React.createElement("p", null,
                    "Value: ",
                    regionDragging && regionDragging.map((n) => n.toFixed(3)).join(', ')),
                React.createElement("div", { className: "DraggableManagerDemo--realm" },
                    React.createElement(RegionDemo, { regionCursor: regionCursor, regionDragging: regionDragging, updateState: this._updateState })))));
    }
}
//# sourceMappingURL=DraggableManagerDemo.js.map