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
import { render, screen } from '@testing-library/react';
import React from 'react';
import TimelineViewingLayer from './TimelineViewingLayer';
describe('<TimelineViewingLayer>', () => {
    const viewStart = 0.25;
    const viewEnd = 0.9;
    let props = {
        boundsInvalidator: Math.random(),
        updateNextViewRangeTime: jest.fn(),
        updateViewRangeTime: jest.fn(),
        viewRangeTime: {
            current: [viewStart, viewEnd],
        },
    };
    it('renders without exploding', () => {
        render(React.createElement(TimelineViewingLayer, Object.assign({}, props)));
        expect(screen.getByTestId('TimelineViewingLayer')).toBeTruthy();
    });
    describe('render()', () => {
        it('renders nothing without a nextViewRangeTime', () => {
            render(React.createElement(TimelineViewingLayer, Object.assign({}, props)));
            expect(screen.queryByTestId('TimelineViewingLayer--cursorGuide')).not.toBeInTheDocument();
        });
    });
    it('renders the cursor when it is the only non-current value set', () => {
        const cursor = viewStart + 0.5 * (viewEnd - viewStart);
        const baseViewRangeTime = Object.assign(Object.assign({}, props.viewRangeTime), { cursor });
        props = Object.assign(Object.assign({}, props), { viewRangeTime: baseViewRangeTime });
        render(React.createElement(TimelineViewingLayer, Object.assign({}, props)));
        expect(screen.queryByTestId('TimelineViewingLayer--cursorGuide')).toBeInTheDocument();
    });
    it('does not render the cursor when shiftStart, shiftEnd, or reframe are present', () => {
        const cursor = viewStart + 0.5 * (viewEnd - viewStart);
        const baseViewRangeTime = Object.assign(Object.assign({}, props.viewRangeTime), { cursor });
        let viewRangeTime = Object.assign(Object.assign({}, baseViewRangeTime), { shiftStart: cursor, shiftEnd: cursor, reframe: { anchor: cursor, shift: cursor } });
        props = Object.assign(Object.assign({}, props), { viewRangeTime });
        render(React.createElement(TimelineViewingLayer, Object.assign({}, props)));
        expect(screen.queryByTestId('TimelineViewingLayer--cursorGuide')).not.toBeInTheDocument();
        viewRangeTime = Object.assign(Object.assign({}, baseViewRangeTime), { shiftEnd: cursor });
        props = Object.assign(Object.assign({}, props), { viewRangeTime });
        render(React.createElement(TimelineViewingLayer, Object.assign({}, props)));
        expect(screen.queryByTestId('TimelineViewingLayer--cursorGuide')).not.toBeInTheDocument();
        viewRangeTime = Object.assign(Object.assign({}, baseViewRangeTime), { reframe: { anchor: cursor, shift: cursor } });
        props = Object.assign(Object.assign({}, props), { viewRangeTime });
        render(React.createElement(TimelineViewingLayer, Object.assign({}, props)));
        expect(screen.queryByTestId('TimelineViewingLayer--cursorGuide')).not.toBeInTheDocument();
    });
});
//# sourceMappingURL=TimelineViewingLayer.test.js.map