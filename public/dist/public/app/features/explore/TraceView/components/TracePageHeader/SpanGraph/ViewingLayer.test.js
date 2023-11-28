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
import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { polyfill as polyfillAnimationFrame } from '../../utils/test/requestAnimationFrame';
import ViewingLayer from './ViewingLayer';
function getViewRange(viewStart, viewEnd) {
    return {
        time: {
            current: [viewStart, viewEnd],
        },
    };
}
describe('<UnthemedViewingLayer>', () => {
    polyfillAnimationFrame(window);
    let props;
    beforeEach(() => {
        props = {
            height: 60,
            numTicks: 5,
            updateNextViewRangeTime: jest.fn(),
            updateViewRangeTime: jest.fn(),
            viewRange: getViewRange(0, 1),
        };
    });
    it('does not render ViewingLayerCursorGuide if the cursor position is not defined', () => {
        render(React.createElement(ViewingLayer, Object.assign({}, props)));
        expect(screen.queryByTestId('ViewingLayerCursorGuide')).toBeNull();
    });
    it('renders ViewingLayerCursorGuide when the cursor position is defined', () => {
        props = Object.assign(Object.assign({}, props), { viewRange: { time: { current: [0.1, 1], cursor: 0.5 } } });
        render(React.createElement(ViewingLayer, Object.assign({}, props)));
        expect(screen.getByTestId('ViewingLayerCursorGuide')).toBeTruthy();
    });
    it('renders <GraphTicks />', () => {
        render(React.createElement(ViewingLayer, Object.assign({}, props)));
        expect(screen.getByTestId('ticks')).toBeTruthy();
    });
    it('renders the scrubber component lines in the correct locations when an area of the minimap is selected', () => {
        props = Object.assign(Object.assign({}, props), { viewRange: { time: { current: [0.3, 0.7] } } });
        render(React.createElement(ViewingLayer, Object.assign({}, props)));
        expect(screen.getAllByTestId('scrubber-component-line')[0]).toHaveAttribute('x1', '30%');
        expect(screen.getAllByTestId('scrubber-component-line')[1]).toHaveAttribute('x1', '70%');
    });
    it('renders the scrubbers', () => {
        render(React.createElement(ViewingLayer, Object.assign({}, props)));
        expect(screen.getAllByTestId('scrubber-component')).toBeTruthy();
    });
    it('renders a filtering box if leftBound exists', () => {
        props = Object.assign(Object.assign({}, props), { viewRange: { time: { current: [0.1, 0.9] } } });
        render(React.createElement(ViewingLayer, Object.assign({}, props)));
        expect(screen.getByTestId('left-ViewingLayerInactive')).toHaveAttribute('width', '10%');
        expect(screen.getByTestId('left-ViewingLayerInactive')).toHaveAttribute('x', '0');
    });
    it('renders a filtering box if rightBound exists', () => {
        props = Object.assign(Object.assign({}, props), { viewRange: { time: { current: [0, 0.8] } } });
        render(React.createElement(ViewingLayer, Object.assign({}, props)));
        expect(screen.getByTestId('right-ViewingLayerInactive')).toHaveAttribute('width', '20%');
        expect(screen.getByTestId('right-ViewingLayerInactive')).toHaveAttribute('x', '80%');
    });
    describe('reset selection button', () => {
        it('should not render the reset selection button if props.viewRange.time.current = [0,1]', () => {
            render(React.createElement(ViewingLayer, Object.assign({}, props)));
            expect(screen.queryByRole('button', { hidden: true })).toBeNull();
        });
        it('should render the reset selection button if props.viewRange.time.current[0] !== 0', () => {
            props = Object.assign(Object.assign({}, props), { viewRange: { time: { current: [0.1, 1] } } });
            render(React.createElement(ViewingLayer, Object.assign({}, props)));
            expect(screen.queryByRole('button', { hidden: true })).toBeInTheDocument();
        });
        it('should render the reset selection button if props.viewRange.time.current[1] !== 1', () => {
            props = Object.assign(Object.assign({}, props), { viewRange: { time: { current: [0, 0.9] } } });
            render(React.createElement(ViewingLayer, Object.assign({}, props)));
            expect(screen.queryByRole('button', { hidden: true })).toBeInTheDocument();
        });
        it('should call props.updateViewRangeTime when clicked', () => __awaiter(void 0, void 0, void 0, function* () {
            props = Object.assign(Object.assign({}, props), { viewRange: { time: { current: [0.1, 0.9] } } });
            render(React.createElement(ViewingLayer, Object.assign({}, props)));
            const button = screen.queryByRole('button', { hidden: true });
            yield userEvent.click(button);
            expect(props.updateViewRangeTime).toHaveBeenCalledWith(0, 1);
        }));
    });
});
//# sourceMappingURL=ViewingLayer.test.js.map