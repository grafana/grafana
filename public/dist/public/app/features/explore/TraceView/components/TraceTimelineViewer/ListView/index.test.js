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
import { __rest } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import ListView from './index';
const DATA_LENGTH = 10;
function getHeight(index) {
    return index * 2 + 2;
}
function Item(props) {
    const { children } = props, rest = __rest(props, ["children"]);
    return React.createElement("div", Object.assign({}, rest), children);
}
const renderItem = (itemKey, styles, itemIndex, attrs) => {
    return (React.createElement(Item, Object.assign({ key: itemKey, style: styles }, attrs, { "data-testid": "item" }), itemIndex));
};
const props = {
    dataLength: DATA_LENGTH,
    getIndexFromKey: Number,
    getKeyFromIndex: String,
    initialDraw: 5,
    itemHeightGetter: getHeight,
    itemRenderer: renderItem,
    itemsWrapperClassName: 'SomeClassName',
    viewBuffer: 10,
    viewBufferMin: 5,
    windowScroller: true,
};
describe('<ListView />', () => {
    beforeEach(() => {
        render(React.createElement(ListView, Object.assign({}, props)));
    });
    it('renders without exploding', () => {
        expect(screen.getByTestId('ListView')).toBeInTheDocument();
    });
    it('renders the correct number of items', () => {
        expect(screen.getAllByTestId('item').length).toBe(DATA_LENGTH);
    });
});
//# sourceMappingURL=index.test.js.map