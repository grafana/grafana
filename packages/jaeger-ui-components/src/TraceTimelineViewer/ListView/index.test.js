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
import { mount, shallow } from 'enzyme';

import ListView from './index';
import { polyfill as polyfillAnimationFrame } from '../../utils/test/requestAnimationFrame';

// Util to get list of all callbacks added to an event emitter by event type.
// jest adds "error" event listeners to window, this util makes it easier to
// ignore those calls.
function getListenersByType(mockFn) {
  const rv = {};
  mockFn.calls.forEach(([eventType, callback]) => {
    if (!rv[eventType]) {
      rv[eventType] = [callback];
    } else {
      rv[eventType].push(callback);
    }
  });
  return rv;
}

describe('<ListView>', () => {
  // polyfill window.requestAnimationFrame (and cancel) into jsDom's window
  polyfillAnimationFrame(window);

  const DATA_LENGTH = 40;

  function getHeight(index) {
    return index * 2 + 2;
  }

  function Item(props) {
    const { children, ...rest } = props;
    return <div {...rest}>{children}</div>;
  }

  function renderItem(itemKey, styles, itemIndex, attrs) {
    return (
      <Item key={itemKey} style={styles} {...attrs}>
        {itemIndex}
      </Item>
    );
  }

  let wrapper;
  let instance;

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
    windowScroller: false,
  };

  describe('shallow tests', () => {
    beforeEach(() => {
      wrapper = shallow(<ListView {...props} />);
    });

    it('renders without exploding', () => {
      expect(wrapper).toBeDefined();
    });

    it('matches a snapshot', () => {
      expect(wrapper).toMatchSnapshot();
    });

    it('initialDraw sets the number of items initially drawn', () => {
      expect(wrapper.find(Item).length).toBe(props.initialDraw);
    });

    it('sets the height of the items according to the height func', () => {
      const items = wrapper.find(Item);
      const expectedHeights = [];
      const heights = items.map((node, i) => {
        expectedHeights.push(getHeight(i));
        return node.prop('style').height;
      });
      expect(heights.length).toBe(props.initialDraw);
      expect(heights).toEqual(expectedHeights);
    });

    it('saves the currently drawn indexes to _startIndexDrawn and _endIndexDrawn', () => {
      const inst = wrapper.instance();
      expect(inst._startIndexDrawn).toBe(0);
      expect(inst._endIndexDrawn).toBe(props.initialDraw - 1);
    });
  });

  describe('mount tests', () => {
    describe('accessor functions', () => {
      const clientHeight = 2;
      const scrollTop = 3;

      let oldRender;
      let oldInitWrapper;
      const initWrapperMock = jest.fn(elm => {
        if (elm != null) {
          // jsDom requires `defineProperties` instead of just setting the props
          Object.defineProperties(elm, {
            clientHeight: {
              get: () => clientHeight,
            },
            scrollTop: {
              get: () => scrollTop,
            },
          });
        }
        oldInitWrapper.call(this, elm);
      });

      beforeAll(() => {
        oldRender = ListView.prototype.render;
        // `_initWrapper` is not on the prototype, so it needs to be mocked
        // on each instance, use `render()` as a hook to do that
        ListView.prototype.render = function altRender() {
          if (this._initWrapper !== initWrapperMock) {
            oldInitWrapper = this._initWrapper;
            this._initWrapper = initWrapperMock;
          }
          return oldRender.call(this);
        };
      });

      afterAll(() => {
        ListView.prototype.render = oldRender;
      });

      beforeEach(() => {
        initWrapperMock.mockClear();
        wrapper = mount(<ListView {...props} />);
        instance = wrapper.instance();
      });

      it('getViewHeight() returns the viewHeight', () => {
        expect(instance.getViewHeight()).toBe(clientHeight);
      });

      it('getBottomVisibleIndex() returns a number', () => {
        const n = instance.getBottomVisibleIndex();
        expect(Number.isNaN(n)).toBe(false);
        expect(n).toEqual(expect.any(Number));
      });

      it('getTopVisibleIndex() returns a number', () => {
        const n = instance.getTopVisibleIndex();
        expect(Number.isNaN(n)).toBe(false);
        expect(n).toEqual(expect.any(Number));
      });

      it('getRowPosition() returns a number', () => {
        const { height, y } = instance.getRowPosition(2);
        expect(height).toEqual(expect.any(Number));
        expect(y).toEqual(expect.any(Number));
      });
    });

    describe('windowScroller', () => {
      let windowAddListenerSpy;
      let windowRmListenerSpy;

      beforeEach(() => {
        windowAddListenerSpy = jest.spyOn(window, 'addEventListener');
        windowRmListenerSpy = jest.spyOn(window, 'removeEventListener');
        const wsProps = { ...props, windowScroller: true };
        wrapper = mount(<ListView {...wsProps} />);
        instance = wrapper.instance();
      });

      afterEach(() => {
        windowAddListenerSpy.mockRestore();
      });

      it('adds the onScroll listener to the window element after the component mounts', () => {
        const eventListeners = getListenersByType(windowAddListenerSpy.mock);
        expect(eventListeners.scroll).toEqual([instance._onScroll]);
      });

      it('removes the onScroll listener from window when unmounting', () => {
        // jest adds "error" event listeners to window, ignore those calls
        let eventListeners = getListenersByType(windowRmListenerSpy.mock);
        expect(eventListeners.scroll).not.toBeDefined();
        wrapper.unmount();
        eventListeners = getListenersByType(windowRmListenerSpy.mock);
        expect(eventListeners.scroll).toEqual([instance._onScroll]);
      });

      it('calls _positionList when the document is scrolled', done => {
        const event = new Event('scroll');
        const fn = jest.spyOn(instance, '_positionList');
        expect(instance._isScrolledOrResized).toBe(false);
        window.dispatchEvent(event);
        expect(instance._isScrolledOrResized).toBe(true);
        window.requestAnimationFrame(() => {
          expect(fn).toHaveBeenCalled();
          done();
        });
      });

      it('uses the root HTML element to determine if the view has changed', () => {
        const htmlElm = instance._htmlElm;
        expect(htmlElm).toBeTruthy();
        const spyFns = {
          clientHeight: jest.fn(() => instance._viewHeight + 1),
          scrollTop: jest.fn(() => instance._scrollTop + 1),
        };
        Object.defineProperties(htmlElm, {
          clientHeight: {
            get: spyFns.clientHeight,
          },
          scrollTop: {
            get: spyFns.scrollTop,
          },
        });
        const hasChanged = instance._isViewChanged();
        expect(spyFns.clientHeight).toHaveBeenCalled();
        expect(spyFns.scrollTop).toHaveBeenCalled();
        expect(hasChanged).toBe(true);
      });
    });
  });
});
