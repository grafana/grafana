// Copyright (c) 2018 Uber Technologies, Inc.
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

import { render, screen, fireEvent, createEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { shallow } from 'enzyme';
import React from 'react';
import IoChevronRight from 'react-icons/lib/io/chevron-right';
import IoIosArrowDown from 'react-icons/lib/io/ios-arrow-down';

import { createTheme } from '@grafana/data';

import spanAncestorIdsSpy from '../utils/span-ancestor-ids';

import SpanTreeOffset, { getStyles } from './SpanTreeOffset';

jest.mock('../utils/span-ancestor-ids');

describe('SpanTreeOffset', () => {
  const ownSpanID = 'ownSpanID';
  const parentSpanID = 'parentSpanID';
  const rootSpanID = 'rootSpanID';
  const specialRootID = 'root';
  let props;
  // let wrapper;

  const parentProps = {
    addHoverIndentGuideId: jest.fn(),
    hoverIndentGuideIds: new Set(),
    removeHoverIndentGuideId: jest.fn(),
    span: {
      hasChildren: false,
      spanID: parentSpanID,
    },
  };

  beforeEach(() => {
    // Mock implementation instead of Mock return value so that each call returns a new array (like normal)
    spanAncestorIdsSpy.mockImplementation(() => [parentSpanID, rootSpanID]);
    props = {
      addHoverIndentGuideId: jest.fn(),
      hoverIndentGuideIds: new Set(),
      removeHoverIndentGuideId: jest.fn(),
      span: {
        hasChildren: false,
        spanID: ownSpanID,
      },
    };
  });

  describe('.SpanTreeOffset--indentGuide', () => {
    it('renders only one .SpanTreeOffset--indentGuide for entire trace if span has no ancestors', () => {
      spanAncestorIdsSpy.mockReturnValue([]);
      render(<SpanTreeOffset {...props} />);
      const indentGuide = screen.getByTestId('SpanTreeOffset--indentGuide');
      expect(indentGuide).toBeInTheDocument();
      expect(indentGuide).toHaveAttribute('data-ancestor-id', specialRootID);
    });

    it('renders one .SpanTreeOffset--indentGuide per ancestor span, plus one for entire trace', () => {
      render(<SpanTreeOffset {...props} />);
      const indentGuides = screen.getAllByTestId('SpanTreeOffset--indentGuide');
      expect(indentGuides.length).toBe(3);
      expect(indentGuides[0]).toHaveAttribute('data-ancestor-id', specialRootID);
      expect(indentGuides[1]).toHaveAttribute('data-ancestor-id', rootSpanID);
      expect(indentGuides[2]).toHaveAttribute('data-ancestor-id', parentSpanID);
    });

    it('adds .is-active to correct indentGuide', () => {
      props.hoverIndentGuideIds = new Set([parentSpanID]);
      render(<SpanTreeOffset {...props} />);
      const styles = getStyles(createTheme());
      const activeIndentGuide = document.querySelector(`.${styles.indentGuideActive}`);
      expect(activeIndentGuide).toBeInTheDocument();
      expect(activeIndentGuide).toHaveAttribute('data-ancestor-id', parentSpanID);
    });

    it.skip('calls props.addHoverIndentGuideId on mouse enter', async () => {
      render(<SpanTreeOffset {...props} />);
      const span = document.querySelector(`[data-ancestor-id=${parentSpanID}]`);
      // await userEvent.hover(span);
      // const event = createEvent.mouseEnter(span, {
      //   bubbles: false, cancelable: false, composed: true
      // });
      // const event = new MouseEvent('mouseenter', {
      //   bubbles: false, cancelable: false, composed: true
      // });
      // fireEvent(span, event);
      // fireEvent.mouseEnter(span);
      await userEvent.hover(span);
      expect(props.addHoverIndentGuideId).toHaveBeenCalledTimes(1);
      expect(props.addHoverIndentGuideId).toHaveBeenCalledWith(parentSpanID);
    });

    it.skip('does not call props.addHoverIndentGuideId on mouse enter if mouse came from a indentGuide with the same ancestorId', () => {
      render(
        <>
          <SpanTreeOffset {...parentProps} />
          <SpanTreeOffset {...props} />
        </>
      );
      const span = document.querySelector(`[data-ancestor-id=${parentSpanID}]`);
      const relatedTarget = document.createElement('span');
      relatedTarget.dataset.ancestorId = parentSpanID;
      const event = new MouseEvent('mouseenter', {
        bubbles: false,
        cancelable: false,
        composed: true,
      });
      event.relatedTarget = relatedTarget;
      fireEvent(span, event);
      // fireEvent.mouseEnter(span, {
      //   relatedTarget,
      // });
      expect(props.addHoverIndentGuideId).not.toHaveBeenCalled();
    });

    it.skip('calls props.removeHoverIndentGuideId on mouse leave', async () => {
      render(<SpanTreeOffset {...props} />);
      const span = document.querySelector(`[data-ancestor-id=${parentSpanID}]`);
      fireEvent.mouseLeave(span);
      expect(props.removeHoverIndentGuideId).toHaveBeenCalledTimes(1);
      expect(props.removeHoverIndentGuideId).toHaveBeenCalledWith(parentSpanID);
    });

    it.skip('does not call props.removeHoverIndentGuideId on mouse leave if mouse leaves to a indentGuide with the same ancestorId', () => {
      render(<SpanTreeOffset {...props} />);
      const span = document.querySelector(`[data-ancestor-id=${parentSpanID}]`);
      const relatedTarget = document.createElement('span');
      relatedTarget.dataset.ancestorId = parentSpanID;
      fireEvent.mouseLeave(span, { relatedTarget });
      wrapper.find({ 'data-ancestor-id': parentSpanID }).simulate('mouseleave', {
        relatedTarget,
      });
      expect(props.removeHoverIndentGuideId).not.toHaveBeenCalled();
    });
  });

  describe('icon', () => {
    beforeEach(() => {
      props = { ...props, span: { ...props.span, hasChildren: true } };
    });

    it('does not render icon if props.span.hasChildren is false', () => {
      props.span.hasChildren = false;
      render(<SpanTreeOffset {...props} />);
      expect(screen.queryByTestId('icon-wrapper')).not.toBeInTheDocument();
    });

    it('does not render icon if props.span.hasChildren is true and showChildrenIcon is false', () => {
      props.showChildrenIcon = false;
      render(<SpanTreeOffset {...props} />);
      expect(screen.queryByTestId('icon-wrapper')).not.toBeInTheDocument();
    });

    it('renders arrow-right if props.span.hasChildren is true and props.childrenVisible is false', () => {
      render(<SpanTreeOffset {...props} />);
      expect(screen.getByTestId('icon-arrow-right')).toBeInTheDocument();
    });

    it('renders arrow-down if props.span.hasChildren is true and props.childrenVisible is true', () => {
      props.childrenVisible = true;
      render(<SpanTreeOffset {...props} />);
      expect(screen.getByTestId('icon-arrow-down')).toBeInTheDocument();
    });

    it.skip('calls props.addHoverIndentGuideId on mouse enter', () => {
      wrapper.find('[data-testid="icon-wrapper"]').simulate('mouseenter', {});
      expect(props.addHoverIndentGuideId).toHaveBeenCalledTimes(1);
      expect(props.addHoverIndentGuideId).toHaveBeenCalledWith(ownSpanID);
    });

    it.skip('calls props.removeHoverIndentGuideId on mouse leave', () => {
      wrapper.find('[data-testid="icon-wrapper"]').simulate('mouseleave', {});
      expect(props.removeHoverIndentGuideId).toHaveBeenCalledTimes(1);
      expect(props.removeHoverIndentGuideId).toHaveBeenCalledWith(ownSpanID);
    });
  });
});
