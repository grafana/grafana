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

import { cx } from '@emotion/css';
import { mount, ReactWrapper } from 'enzyme';
import React from 'react';
import DraggableManager, { DraggingUpdate } from 'src/utils/DraggableManager';

import { ViewRangeTime } from '../types';

import TimelineViewingLayer, { getStyles, TimelineViewingLayerProps } from './TimelineViewingLayer';

function mapFromSubRange(viewStart: number, viewEnd: number, value: number) {
  return viewStart + value * (viewEnd - viewStart);
}

describe('<TimelineViewingLayer>', () => {
  let wrapper: ReactWrapper<TimelineViewingLayerProps, {}, TimelineViewingLayer>;
  let instance: TimelineViewingLayer;

  const viewStart = 0.25;
  const viewEnd = 0.9;
  const props = {
    boundsInvalidator: Math.random(),
    updateNextViewRangeTime: jest.fn(),
    updateViewRangeTime: jest.fn(),
    viewRangeTime: {
      current: [viewStart, viewEnd] as [number, number],
    },
  };

  beforeEach(() => {
    props.updateNextViewRangeTime.mockReset();
    props.updateViewRangeTime.mockReset();
    wrapper = mount(<TimelineViewingLayer {...(props as unknown as TimelineViewingLayerProps)} />);
    instance = wrapper.instance();
  });

  it('renders without exploding', () => {
    expect(wrapper).toBeDefined();
    expect(wrapper.find('[data-testid="TimelineViewingLayer"]').length).toBe(1);
  });

  it('sets _root to the root DOM node', () => {
    expect(instance._root).toBeDefined();
    expect(wrapper.find('[data-testid="TimelineViewingLayer"]').getDOMNode()).toBe(instance._root);
  });

  describe('uses DraggableManager', () => {
    it('initializes the DraggableManager', () => {
      const dm = instance._draggerReframe;
      expect(dm).toBeDefined();
      expect(dm._onMouseMove).toBe(instance._handleReframeMouseMove);
      expect(dm._onMouseLeave).toBe(instance._handleReframeMouseLeave);
      expect(dm._onDragStart).toBe(instance._handleReframeDragUpdate);
      expect(dm._onDragMove).toBe(instance._handleReframeDragUpdate);
      expect(dm._onDragEnd).toBe(instance._handleReframeDragEnd);
    });

    it('provides the DraggableManager handlers as callbacks', () => {
      const { handleMouseDown, handleMouseLeave, handleMouseMove } = instance._draggerReframe;
      const rootWrapper = wrapper.find('[data-testid="TimelineViewingLayer"]');
      expect(rootWrapper.prop('onMouseDown')).toBe(handleMouseDown);
      expect(rootWrapper.prop('onMouseLeave')).toBe(handleMouseLeave);
      expect(rootWrapper.prop('onMouseMove')).toBe(handleMouseMove);
    });

    it('returns the dragging bounds from _getDraggingBounds()', () => {
      const left = 10;
      const width = 100;
      instance._root!.getBoundingClientRect = () => ({ left, width } as DOMRect);
      expect(instance._getDraggingBounds()).toEqual({ width, clientXLeft: left });
    });

    it('updates viewRange.time.cursor via _draggerReframe._onMouseMove', () => {
      const value = 0.5;
      const cursor = mapFromSubRange(viewStart, viewEnd, value);
      instance._draggerReframe._onMouseMove!({ value } as DraggingUpdate);
      expect(props.updateNextViewRangeTime.mock.calls).toEqual([[{ cursor }]]);
    });

    it('resets viewRange.time.cursor via _draggerReframe._onMouseLeave', () => {
      instance._draggerReframe._onMouseLeave!(null as unknown as DraggingUpdate);
      expect(props.updateNextViewRangeTime.mock.calls).toEqual([[{ cursor: undefined }]]);
    });

    it('handles drag start via _draggerReframe._onDragStart', () => {
      const value = 0.5;
      const shift = mapFromSubRange(viewStart, viewEnd, value);
      const update = { reframe: { shift, anchor: shift } };
      instance._draggerReframe._onDragStart!({ value } as DraggingUpdate);
      expect(props.updateNextViewRangeTime.mock.calls).toEqual([[update]]);
    });

    it('handles drag move via _draggerReframe._onDragMove', () => {
      const anchor = 0.25;
      const viewRangeTime = { ...props.viewRangeTime, reframe: { anchor, shift: Math.random() } } as ViewRangeTime;
      const value = 0.5;
      const shift = mapFromSubRange(viewStart, viewEnd, value);
      // make sure `anchor` is already present on the props
      wrapper.setProps({ viewRangeTime });
      expect(wrapper.prop('viewRangeTime').reframe?.anchor).toBe(anchor);
      // the next update should integrate `value` and use the existing anchor
      instance._draggerReframe._onDragStart!({ value } as DraggingUpdate);
      const update = { reframe: { anchor, shift } };
      expect(props.updateNextViewRangeTime.mock.calls).toEqual([[update]]);
    });

    it('handles drag end via _draggerReframe._onDragEnd', () => {
      const manager = { resetBounds: jest.fn() } as unknown as DraggableManager;
      const value = 0.5;
      const shift = mapFromSubRange(viewStart, viewEnd, value);
      const anchor = 0.25;
      const viewRangeTime = { ...props.viewRangeTime, reframe: { anchor, shift: Math.random() } } as ViewRangeTime;
      wrapper.setProps({ viewRangeTime });
      instance._draggerReframe._onDragEnd!({ manager, value } as DraggingUpdate);
      expect(jest.mocked(manager.resetBounds).mock.calls).toEqual([[]]);
      expect(props.updateViewRangeTime.mock.calls).toEqual([[anchor, shift, 'timeline-header']]);
    });
  });

  describe('render()', () => {
    it('renders nothing without a nextViewRangeTime', () => {
      expect(wrapper.find('div').length).toBe(1);
    });

    it('renders the cursor when it is the only non-current value set', () => {
      const cursor = viewStart + 0.5 * (viewEnd - viewStart);
      const baseViewRangeTime = { ...props.viewRangeTime, cursor };
      wrapper.setProps({ viewRangeTime: baseViewRangeTime });
      // cursor is rendered when solo
      expect(wrapper.find('[data-testid="TimelineViewingLayer--cursorGuide"]').length).toBe(1);
      // cursor is skipped when shiftStart, shiftEnd, or reframe are present
      let viewRangeTime: ViewRangeTime = {
        ...baseViewRangeTime,
        shiftStart: cursor,
        shiftEnd: cursor,
        reframe: { anchor: cursor, shift: cursor },
      };
      wrapper.setProps({ viewRangeTime });
      expect(wrapper.find('[data-testid="TimelineViewingLayer--cursorGuide"]').length).toBe(0);
      viewRangeTime = { ...baseViewRangeTime, shiftEnd: cursor };
      wrapper.setProps({ viewRangeTime });
      expect(wrapper.find('[data-testid="TimelineViewingLayer--cursorGuide"]').length).toBe(0);
      viewRangeTime = { ...baseViewRangeTime, reframe: { anchor: cursor, shift: cursor } };
      wrapper.setProps({ viewRangeTime });
      expect(wrapper.find('[data-testid="TimelineViewingLayer--cursorGuide"]').length).toBe(0);
    });

    it('renders the reframe dragging', () => {
      const viewRangeTime = { ...props.viewRangeTime, reframe: { anchor: viewStart, shift: viewEnd } };
      wrapper.setProps({ viewRangeTime });
      const styles = getStyles();
      expect(
        wrapper.find('[data-testid="Dragged"]').prop('className')!.indexOf(
          cx(
            styles.TimelineViewingLayerDragged,
            styles.TimelineViewingLayerDraggedDraggingLeft,
            styles.TimelineViewingLayerDraggedDraggingRight,
            styles.TimelineViewingLayerDraggedReframeDrag
          )
            // The prefix generated by cx (e.g. css-<id>) is different each time due to different IDs being generated, so we're using split/slice/join to remove the prefix from the string so we're not looking for the index of something which will never exist.
            // i.e. instead of doing something like:
            // 'css-7g92us-TimelineViewingLayerDragged-Timeline...'.indexOf('css-differentId-TimelineViewingLayerDragged-Timeline...')
            // which would always fail, instead we're doing:
            // 'css-7g92us-TimelineViewingLayerDragged-Timeline...'.indexOf('TimelineViewingLayerDragged-Timeline...')
            .split('-')
            .slice(2)
            .join('-')
        ) >= 0
      ).toBe(true);
    });

    it('renders the shiftStart dragging', () => {
      const viewRangeTime = { ...props.viewRangeTime, shiftStart: viewEnd };
      wrapper.setProps({ viewRangeTime });
      const styles = getStyles();
      expect(
        wrapper
          .find('[data-testid="Dragged"]')
          .prop('className')!
          .indexOf(
            cx(
              styles.TimelineViewingLayerDragged,
              styles.TimelineViewingLayerDraggedDraggingLeft,
              styles.TimelineViewingLayerDraggedDraggingRight,
              styles.TimelineViewingLayerDraggedShiftDrag
            )
              .split('-')
              .slice(2)
              .join('-')
          ) >= 0
      ).toBe(true);
    });

    it('renders the shiftEnd dragging', () => {
      const viewRangeTime = { ...props.viewRangeTime, shiftEnd: viewStart };
      wrapper.setProps({ viewRangeTime });
      const styles = getStyles();
      expect(
        wrapper
          .find('[data-testid="Dragged"]')
          .prop('className')!
          .indexOf(
            cx(
              styles.TimelineViewingLayerDragged,
              styles.TimelineViewingLayerDraggedDraggingLeft,
              styles.TimelineViewingLayerDraggedShiftDrag
            )
              .split('-')
              .slice(2)
              .join('-')
          ) >= 0
      ).toBe(true);
    });
  });
});
