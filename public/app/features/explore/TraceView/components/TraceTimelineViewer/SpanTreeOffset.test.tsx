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

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { createTheme } from '@grafana/data';

import { TraceSpan } from '../types';
import spanAncestorIdsSpy from '../utils/span-ancestor-ids';

import SpanTreeOffset, { getStyles, TProps } from './SpanTreeOffset';

jest.mock('../utils/span-ancestor-ids');

describe('SpanTreeOffset', () => {
  const ownSpanID = 'ownSpanID';
  const parentSpanID = 'parentSpanID';
  const rootSpanID = 'rootSpanID';
  const specialRootID = 'root';
  let props: TProps;

  beforeEach(() => {
    // Mock implementation instead of Mock return value so that each call returns a new array (like normal)
    jest.mocked(spanAncestorIdsSpy).mockImplementation(() => [parentSpanID, rootSpanID]);
    props = {
      addHoverIndentGuideId: jest.fn(),
      hoverIndentGuideIds: new Set(),
      removeHoverIndentGuideId: jest.fn(),
      span: {
        hasChildren: false,
        spanID: ownSpanID,
      } as TraceSpan,
    } as unknown as TProps;
  });

  describe('.SpanTreeOffset--indentGuide', () => {
    it('renders only one SpanTreeOffset--indentGuide for entire trace if span has no ancestors', () => {
      jest.mocked(spanAncestorIdsSpy).mockReturnValue([]);
      render(<SpanTreeOffset {...props} />);
      const indentGuide = screen.getByTestId('SpanTreeOffset--indentGuide');
      expect(indentGuide).toBeInTheDocument();
      expect(indentGuide).toHaveAttribute('data-ancestor-id', specialRootID);
    });

    it('renders one SpanTreeOffset--indentGuide per ancestor span, plus one for entire trace', () => {
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

    it('calls props.addHoverIndentGuideId on mouse enter', async () => {
      render(<SpanTreeOffset {...props} />);
      const span = document.querySelector(`[data-ancestor-id=${parentSpanID}]`);
      await userEvent.hover(span!);
      expect(props.addHoverIndentGuideId).toHaveBeenCalledTimes(1);
      expect(props.addHoverIndentGuideId).toHaveBeenCalledWith(parentSpanID);
    });

    it('calls props.removeHoverIndentGuideId on mouse leave', async () => {
      render(<SpanTreeOffset {...props} />);
      const span = document.querySelector(`[data-ancestor-id=${parentSpanID}]`);
      await userEvent.unhover(span!);
      expect(props.removeHoverIndentGuideId).toHaveBeenCalledTimes(1);
      expect(props.removeHoverIndentGuideId).toHaveBeenCalledWith(parentSpanID);
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

    it('calls props.addHoverIndentGuideId on mouse enter', async () => {
      render(<SpanTreeOffset {...props} />);
      const icon = screen.getByTestId('icon-wrapper');
      await userEvent.hover(icon);
      expect(props.addHoverIndentGuideId).toHaveBeenCalledTimes(1);
      expect(props.addHoverIndentGuideId).toHaveBeenCalledWith(ownSpanID);
    });

    it('calls props.removeHoverIndentGuideId on mouse leave', async () => {
      render(<SpanTreeOffset {...props} />);
      const icon = screen.getByTestId('icon-wrapper');
      await userEvent.unhover(icon);
      expect(props.removeHoverIndentGuideId).toHaveBeenCalledTimes(1);
      expect(props.removeHoverIndentGuideId).toHaveBeenCalledWith(ownSpanID);
    });
  });
});
