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
import { css } from '@emotion/css';
import cx from 'classnames';
import { get as _get } from 'lodash';
import React from 'react';
import { Icon, stylesFactory, withTheme2 } from '@grafana/ui';
import { autoColor } from '../Theme';
import spanAncestorIds from '../utils/span-ancestor-ids';
export const getStyles = stylesFactory((theme) => {
    return {
        SpanTreeOffset: css `
      label: SpanTreeOffset;
      color: ${autoColor(theme, '#000')};
      position: relative;
    `,
        SpanTreeOffsetParent: css `
      label: SpanTreeOffsetParent;
      &:hover {
        cursor: pointer;
      }
    `,
        indentGuide: css `
      label: indentGuide;
      /* The size of the indentGuide is based off of the iconWrapper */
      padding-right: 1rem;
      height: 100%;
      display: inline-flex;
      transition: padding 300ms ease-out;
      &::before {
        content: '';
        padding-left: 1px;
        background-color: ${autoColor(theme, 'lightgrey')};
      }
    `,
        indentGuideActive: css `
      label: indentGuideActive;
      &::before {
        background-color: ${autoColor(theme, '#777')};
      }
    `,
        indentGuideThin: css `
      padding-right: 0.3rem;
    `,
        iconWrapper: css `
      label: iconWrapper;
      position: absolute;
      right: 0;
    `,
    };
});
export class UnthemedSpanTreeOffset extends React.PureComponent {
    constructor(props) {
        super(props);
        /**
         * If the mouse leaves to anywhere except another span with the same ancestor id, this span's ancestor id is
         * removed from the set of hoverIndentGuideIds.
         *
         * @param {Object} event - React Synthetic event tied to mouseleave. Includes the related target which is
         *     the element the user is now hovering.
         * @param {string} ancestorId - The span id that the user was hovering over.
         */
        this.handleMouseLeave = (event, ancestorId) => {
            if (!(event.relatedTarget instanceof HTMLSpanElement) ||
                _get(event, 'relatedTarget.dataset.ancestorId') !== ancestorId) {
                this.props.removeHoverIndentGuideId(ancestorId);
            }
        };
        /**
         * If the mouse entered this span from anywhere except another span with the same ancestor id, this span's
         * ancestorId is added to the set of hoverIndentGuideIds.
         *
         * @param {Object} event - React Synthetic event tied to mouseenter. Includes the related target which is
         *     the last element the user was hovering.
         * @param {string} ancestorId - The span id that the user is now hovering over.
         */
        this.handleMouseEnter = (event, ancestorId) => {
            if (!(event.relatedTarget instanceof HTMLSpanElement) ||
                _get(event, 'relatedTarget.dataset.ancestorId') !== ancestorId) {
                this.props.addHoverIndentGuideId(ancestorId);
            }
        };
        this.ancestorIds = spanAncestorIds(props.span);
        // Some traces have multiple root-level spans, this connects them all under one guideline and adds the
        // necessary padding for the collapse icon on root-level spans.
        this.ancestorIds.push('root');
        this.ancestorIds.reverse();
    }
    render() {
        const { childrenVisible, onClick, showChildrenIcon, span, theme, visibleSpanIds } = this.props;
        const { hasChildren, spanID } = span;
        const wrapperProps = hasChildren ? { onClick, role: 'switch', 'aria-checked': childrenVisible } : null;
        const icon = showChildrenIcon &&
            hasChildren &&
            (childrenVisible ? (React.createElement(Icon, { name: 'angle-down', "data-testid": "icon-arrow-down", size: 'sm' })) : (React.createElement(Icon, { name: 'angle-right', "data-testid": "icon-arrow-right", size: 'sm' })));
        const styles = getStyles(theme);
        return (React.createElement("span", Object.assign({ className: cx(styles.SpanTreeOffset, { [styles.SpanTreeOffsetParent]: hasChildren }) }, wrapperProps),
            this.ancestorIds.map((ancestorId, index) => (React.createElement("span", { key: ancestorId, className: cx(styles.indentGuide, {
                    [styles.indentGuideActive]: this.props.hoverIndentGuideIds.has(ancestorId),
                    [styles.indentGuideThin]: index !== this.ancestorIds.length - 1 && ancestorId !== 'root' && !visibleSpanIds.includes(ancestorId),
                }), "data-ancestor-id": ancestorId, "data-testid": "SpanTreeOffset--indentGuide", onMouseEnter: (event) => this.handleMouseEnter(event, ancestorId), onMouseLeave: (event) => this.handleMouseLeave(event, ancestorId) }))),
            icon && (React.createElement("span", { className: styles.iconWrapper, onMouseEnter: (event) => this.handleMouseEnter(event, spanID), onMouseLeave: (event) => this.handleMouseLeave(event, spanID), "data-testid": "icon-wrapper" }, icon))));
    }
}
UnthemedSpanTreeOffset.displayName = 'UnthemedSpanTreeOffset';
UnthemedSpanTreeOffset.defaultProps = {
    childrenVisible: false,
    showChildrenIcon: true,
};
export default withTheme2(UnthemedSpanTreeOffset);
//# sourceMappingURL=SpanTreeOffset.js.map