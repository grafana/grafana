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

import { shallow } from 'enzyme';
import React from 'react';

import GraphTicks from './GraphTicks';
import Scrubber from './Scrubber';
import ViewingLayer, { dragTypes, getStyles } from './ViewingLayer';
import { EUpdateTypes } from '../../utils/DraggableManager';
import { polyfill as polyfillAnimationFrame } from '../../utils/test/requestAnimationFrame';
import { defaultTheme } from '../../Theme';

function getViewRange(viewStart, viewEnd) {
  return {
    time: {
      current: [viewStart, viewEnd],
    },
  };
}

describe('<SpanGraph>', () => {
  polyfillAnimationFrame(window);

  let props;
  let wrapper;

  beforeEach(() => {
    props = {
      height: 60,
      numTicks: 5,
      updateNextViewRangeTime: jest.fn(),
      updateViewRangeTime: jest.fn(),
      viewRange: getViewRange(0, 1),
    };
    wrapper = shallow(<ViewingLayer {...props} />)
      .dive()
      .dive()
      .dive();
  });

  describe('_getDraggingBounds()', () => {
    beforeEach(() => {
      props = { ...props, viewRange: getViewRange(0.1, 0.9) };
      wrapper = shallow(<ViewingLayer {...props} />)
        .dive()
        .dive()
        .dive();
      wrapper.instance()._setRoot({
        getBoundingClientRect() {
          return { left: 10, width: 100 };
        },
      });
    });

    it('throws if _root is not set', () => {
      const instance = wrapper.instance();
      instance._root = null;
      expect(() => instance._getDraggingBounds(dragTypes.REFRAME)).toThrow();
    });

    it('returns the correct bounds for reframe', () => {
      const bounds = wrapper.instance()._getDraggingBounds(dragTypes.REFRAME);
      expect(bounds).toEqual({
        clientXLeft: 10,
        width: 100,
        maxValue: 1,
        minValue: 0,
      });
    });

    it('returns the correct bounds for shiftStart', () => {
      const bounds = wrapper.instance()._getDraggingBounds(dragTypes.SHIFT_START);
      expect(bounds).toEqual({
        clientXLeft: 10,
        width: 100,
        maxValue: 0.9,
        minValue: 0,
      });
    });

    it('returns the correct bounds for shiftEnd', () => {
      const bounds = wrapper.instance()._getDraggingBounds(dragTypes.SHIFT_END);
      expect(bounds).toEqual({
        clientXLeft: 10,
        width: 100,
        maxValue: 1,
        minValue: 0.1,
      });
    });
  });

  describe('DraggableManager callbacks', () => {
    describe('reframe', () => {
      it('handles mousemove', () => {
        const value = 0.5;
        wrapper.instance()._handleReframeMouseMove({ value });
        const calls = props.updateNextViewRangeTime.mock.calls;
        expect(calls).toEqual([[{ cursor: value }]]);
      });

      it('handles mouseleave', () => {
        wrapper.instance()._handleReframeMouseLeave();
        const calls = props.updateNextViewRangeTime.mock.calls;
        expect(calls).toEqual([[{ cursor: null }]]);
      });

      describe('drag update', () => {
        it('handles sans anchor', () => {
          const value = 0.5;
          wrapper.instance()._handleReframeDragUpdate({ value });
          const calls = props.updateNextViewRangeTime.mock.calls;
          expect(calls).toEqual([[{ reframe: { anchor: value, shift: value } }]]);
        });

        it('handles the existing anchor', () => {
          const value = 0.5;
          const anchor = 0.1;
          const time = { ...props.viewRange.time, reframe: { anchor } };
          props = { ...props, viewRange: { time } };
          wrapper = shallow(<ViewingLayer {...props} />)
            .dive()
            .dive()
            .dive();
          wrapper.instance()._handleReframeDragUpdate({ value });
          const calls = props.updateNextViewRangeTime.mock.calls;
          expect(calls).toEqual([[{ reframe: { anchor, shift: value } }]]);
        });
      });

      describe('drag end', () => {
        let manager;

        beforeEach(() => {
          manager = { resetBounds: jest.fn() };
        });

        it('handles sans anchor', () => {
          const value = 0.5;
          wrapper.instance()._handleReframeDragEnd({ manager, value });
          expect(manager.resetBounds.mock.calls).toEqual([[]]);
          const calls = props.updateViewRangeTime.mock.calls;
          expect(calls).toEqual([[value, value, 'minimap']]);
        });

        it('handles dragged left (anchor is greater)', () => {
          const value = 0.5;
          const anchor = 0.6;
          const time = { ...props.viewRange.time, reframe: { anchor } };
          props = { ...props, viewRange: { time } };
          wrapper = shallow(<ViewingLayer {...props} />)
            .dive()
            .dive()
            .dive();
          wrapper.instance()._handleReframeDragEnd({ manager, value });

          expect(manager.resetBounds.mock.calls).toEqual([[]]);
          const calls = props.updateViewRangeTime.mock.calls;
          expect(calls).toEqual([[value, anchor, 'minimap']]);
        });

        it('handles dragged right (anchor is less)', () => {
          const value = 0.5;
          const anchor = 0.4;
          const time = { ...props.viewRange.time, reframe: { anchor } };
          props = { ...props, viewRange: { time } };
          wrapper = shallow(<ViewingLayer {...props} />)
            .dive()
            .dive()
            .dive();
          wrapper.instance()._handleReframeDragEnd({ manager, value });

          expect(manager.resetBounds.mock.calls).toEqual([[]]);
          const calls = props.updateViewRangeTime.mock.calls;
          expect(calls).toEqual([[anchor, value, 'minimap']]);
        });
      });
    });

    describe('scrubber', () => {
      it('prevents the cursor from being drawn on scrubber mouseover', () => {
        wrapper.instance()._handleScrubberEnterLeave({ type: EUpdateTypes.MouseEnter });
        expect(wrapper.state('preventCursorLine')).toBe(true);
      });

      it('prevents the cursor from being drawn on scrubber mouseleave', () => {
        wrapper.instance()._handleScrubberEnterLeave({ type: EUpdateTypes.MouseLeave });
        expect(wrapper.state('preventCursorLine')).toBe(false);
      });

      describe('drag start and update', () => {
        it('stops propagation on drag start', () => {
          const stopPropagation = jest.fn();
          const update = {
            event: { stopPropagation },
            type: EUpdateTypes.DragStart,
          };
          wrapper.instance()._handleScrubberDragUpdate(update);
          expect(stopPropagation.mock.calls).toEqual([[]]);
        });

        it('updates the viewRange for shiftStart and shiftEnd', () => {
          const instance = wrapper.instance();
          const value = 0.5;
          const cases = [
            {
              dragUpdate: {
                value,
                tag: dragTypes.SHIFT_START,
                type: EUpdateTypes.DragMove,
              },
              viewRangeUpdate: { shiftStart: value },
            },
            {
              dragUpdate: {
                value,
                tag: dragTypes.SHIFT_END,
                type: EUpdateTypes.DragMove,
              },
              viewRangeUpdate: { shiftEnd: value },
            },
          ];
          cases.forEach(_case => {
            instance._handleScrubberDragUpdate(_case.dragUpdate);
            expect(props.updateNextViewRangeTime).lastCalledWith(_case.viewRangeUpdate);
          });
        });
      });

      it('updates the view on drag end', () => {
        const instance = wrapper.instance();
        const [viewStart, viewEnd] = props.viewRange.time.current;
        const value = 0.5;
        const cases = [
          {
            dragUpdate: {
              value,
              manager: { resetBounds: jest.fn() },
              tag: dragTypes.SHIFT_START,
            },
            viewRangeUpdate: [value, viewEnd],
          },
          {
            dragUpdate: {
              value,
              manager: { resetBounds: jest.fn() },
              tag: dragTypes.SHIFT_END,
            },
            viewRangeUpdate: [viewStart, value],
          },
        ];
        cases.forEach(_case => {
          const { manager } = _case.dragUpdate;
          wrapper.setState({ preventCursorLine: true });
          expect(wrapper.state('preventCursorLine')).toBe(true);
          instance._handleScrubberDragEnd(_case.dragUpdate);
          expect(wrapper.state('preventCursorLine')).toBe(false);
          expect(manager.resetBounds.mock.calls).toEqual([[]]);
          expect(props.updateViewRangeTime).lastCalledWith(..._case.viewRangeUpdate, 'minimap');
        });
      });
    });

    describe('.ViewingLayer--resetZoom', () => {
      it('should not render .ViewingLayer--resetZoom if props.viewRange.time.current = [0,1]', () => {
        expect(wrapper.find(`.${getStyles(defaultTheme).ViewingLayerResetZoom}`).length).toBe(0);
        wrapper.setProps({ viewRange: { time: { current: [0, 1] } } });
        expect(wrapper.find(`.${getStyles(defaultTheme).ViewingLayerResetZoom}`).length).toBe(0);
      });

      it('should render ViewingLayer--resetZoom if props.viewRange.time.current[0] !== 0', () => {
        // If the test fails on the following expect statement, this may be a false negative
        expect(wrapper.find(`.${getStyles(defaultTheme).ViewingLayerResetZoom}`).length).toBe(0);
        wrapper.setProps({ viewRange: { time: { current: [0.1, 1] } } });
        expect(wrapper.find(`.${getStyles(defaultTheme).ViewingLayerResetZoom}`).length).toBe(1);
      });

      it('should render ViewingLayer--resetZoom if props.viewRange.time.current[1] !== 1', () => {
        // If the test fails on the following expect statement, this may be a false negative
        expect(wrapper.find(`.${getStyles(defaultTheme).ViewingLayerResetZoom}`).length).toBe(0);
        wrapper.setProps({ viewRange: { time: { current: [0, 0.9] } } });
        expect(wrapper.find(`.${getStyles(defaultTheme).ViewingLayerResetZoom}`).length).toBe(1);
      });

      it('should call props.updateViewRangeTime when clicked', () => {
        wrapper.setProps({ viewRange: { time: { current: [0.1, 0.9] } } });
        const resetZoomButton = wrapper.find(`.${getStyles(defaultTheme).ViewingLayerResetZoom}`);
        // If the test fails on the following expect statement, this may be a false negative caused
        // by a regression to rendering.
        expect(resetZoomButton.length).toBe(1);

        resetZoomButton.simulate('click');
        expect(props.updateViewRangeTime).lastCalledWith(0, 1);
      });
    });
  });

  it('renders a <GraphTicks />', () => {
    expect(wrapper.find(GraphTicks).length).toBe(1);
  });

  it('renders a filtering box if leftBound exists', () => {
    const _props = { ...props, viewRange: getViewRange(0.2, 1) };
    wrapper = shallow(<ViewingLayer {..._props} />)
      .dive()
      .dive()
      .dive();

    const leftBox = wrapper.find(`.${getStyles(defaultTheme).ViewingLayerInactive}`);
    expect(leftBox.length).toBe(1);
    const width = Number(leftBox.prop('width').slice(0, -1));
    const x = leftBox.prop('x');
    expect(Math.round(width)).toBe(20);
    expect(x).toBe(0);
  });

  it('renders a filtering box if rightBound exists', () => {
    const _props = { ...props, viewRange: getViewRange(0, 0.8) };
    wrapper = shallow(<ViewingLayer {..._props} />)
      .dive()
      .dive()
      .dive();

    const rightBox = wrapper.find(`.${getStyles(defaultTheme).ViewingLayerInactive}`);
    expect(rightBox.length).toBe(1);
    const width = Number(rightBox.prop('width').slice(0, -1));
    const x = Number(rightBox.prop('x').slice(0, -1));
    expect(Math.round(width)).toBe(20);
    expect(x).toBe(80);
  });

  it('renders handles for the timeRangeFilter', () => {
    const [viewStart, viewEnd] = props.viewRange.time.current;
    let scrubber = <Scrubber position={viewStart} />;
    expect(wrapper.containsMatchingElement(scrubber)).toBeTruthy();
    scrubber = <Scrubber position={viewEnd} />;
    expect(wrapper.containsMatchingElement(scrubber)).toBeTruthy();
  });
});
