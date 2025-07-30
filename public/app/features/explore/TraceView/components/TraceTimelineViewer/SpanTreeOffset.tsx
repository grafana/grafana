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
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, stylesFactory, withTheme2 } from '@grafana/ui';

import { autoColor } from '../Theme';
import { TraceSpan } from '../types/trace';
import spanAncestorIds from '../utils/span-ancestor-ids';

export const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  SpanTreeOffset: css({
    label: 'SpanTreeOffset',
    color: autoColor(theme, '#000'),
    position: 'relative',
  }),
  SpanTreeOffsetParent: css({
    label: 'SpanTreeOffsetParent',
    '&:hover': {
      cursor: 'pointer',
    },
  }),
  indentGuide: css({
    label: 'indentGuide',
    /* The size of the indentGuide is based off of the iconWrapper */
    paddingRight: '1rem',
    height: '100%',
    display: 'inline-flex',
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'padding 300ms ease-out',
    },
    '&::before': {
      content: '""',
      paddingLeft: '1px',
      backgroundColor: autoColor(theme, 'lightgrey'),
    },
  }),
  indentGuideActive: css({
    label: 'indentGuideActive',
    '&::before': {
      backgroundColor: autoColor(theme, '#777'),
    },
  }),
  indentGuideThin: css({
    paddingRight: '0.3rem',
  }),
  iconWrapper: css({
    label: 'iconWrapper',
    position: 'absolute',
    right: 0,
  }),
}));

export type TProps = {
  childrenVisible?: boolean;
  onClick?: () => void;
  span: TraceSpan;
  showChildrenIcon?: boolean;

  hoverIndentGuideIds: Set<string>;
  addHoverIndentGuideId: (spanID: string) => void;
  removeHoverIndentGuideId: (spanID: string) => void;
  theme: GrafanaTheme2;
  visibleSpanIds: string[];
};

export class UnthemedSpanTreeOffset extends React.PureComponent<TProps> {
  static displayName = 'UnthemedSpanTreeOffset';

  ancestorIds: string[];

  static defaultProps = {
    childrenVisible: false,
    showChildrenIcon: true,
  };

  constructor(props: TProps) {
    super(props);

    this.ancestorIds = spanAncestorIds(props.span);
    // Some traces have multiple root-level spans, this connects them all under one guideline and adds the
    // necessary padding for the collapse icon on root-level spans.
    this.ancestorIds.push('root');

    this.ancestorIds.reverse();
  }

  /**
   * If the mouse leaves to anywhere except another span with the same ancestor id, this span's ancestor id is
   * removed from the set of hoverIndentGuideIds.
   *
   * @param {Object} event - React Synthetic event tied to mouseleave. Includes the related target which is
   *     the element the user is now hovering.
   * @param {string} ancestorId - The span id that the user was hovering over.
   */
  handleMouseLeave = (event: React.MouseEvent<HTMLSpanElement>, ancestorId: string) => {
    if (
      !(event.relatedTarget instanceof HTMLSpanElement) ||
      _get(event, 'relatedTarget.dataset.ancestorId') !== ancestorId
    ) {
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
  handleMouseEnter = (event: React.MouseEvent<HTMLSpanElement>, ancestorId: string) => {
    if (
      !(event.relatedTarget instanceof HTMLSpanElement) ||
      _get(event, 'relatedTarget.dataset.ancestorId') !== ancestorId
    ) {
      this.props.addHoverIndentGuideId(ancestorId);
    }
  };

  render() {
    const { childrenVisible, onClick, showChildrenIcon, span, theme, visibleSpanIds } = this.props;
    const { hasChildren, spanID } = span;
    const wrapperProps = hasChildren ? { onClick, role: 'switch', 'aria-checked': childrenVisible } : null;
    const icon =
      showChildrenIcon &&
      hasChildren &&
      (childrenVisible ? (
        <Icon name={'angle-down'} data-testid="icon-arrow-down" size={'sm'} />
      ) : (
        <Icon name={'angle-right'} data-testid="icon-arrow-right" size={'sm'} />
      ));
    const styles = getStyles(theme);

    return (
      <span className={cx(styles.SpanTreeOffset, { [styles.SpanTreeOffsetParent]: hasChildren })} {...wrapperProps}>
        {this.ancestorIds.map((ancestorId, index) => (
          <span
            key={ancestorId}
            className={cx(styles.indentGuide, {
              [styles.indentGuideActive]: this.props.hoverIndentGuideIds.has(ancestorId),
              [styles.indentGuideThin]:
                index !== this.ancestorIds.length - 1 && ancestorId !== 'root' && !visibleSpanIds.includes(ancestorId),
            })}
            data-ancestor-id={ancestorId}
            data-testid="SpanTreeOffset--indentGuide"
            onMouseEnter={(event) => this.handleMouseEnter(event, ancestorId)}
            onMouseLeave={(event) => this.handleMouseLeave(event, ancestorId)}
          />
        ))}
        {icon && (
          <span
            className={styles.iconWrapper}
            onMouseEnter={(event) => this.handleMouseEnter(event, spanID)}
            onMouseLeave={(event) => this.handleMouseLeave(event, spanID)}
            data-testid="icon-wrapper"
          >
            {icon}
          </span>
        )}
      </span>
    );
  }
}

export default withTheme2(UnthemedSpanTreeOffset);
