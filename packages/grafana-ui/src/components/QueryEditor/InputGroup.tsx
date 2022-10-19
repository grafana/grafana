import { css, cx } from '@emotion/css';
import React, { Children, cloneElement, isValidElement, ReactElement } from 'react';

import { useStyles2 } from '../../themes';

type Child = string | undefined | ReactElement<{ className?: string; invalid?: unknown }>;
interface InputGroupProps {
  // we type the children props so we can test them later on
  children: Child | Child[];
}

export const InputGroup = ({ children }: InputGroupProps) => {
  const styles = useStyles2(getStyles);

  // Find children with an invalid prop, and set a class name to raise their z-index so all
  // of the invalid border is visible
  const modifiedChildren = Children.map(children, (child) => {
    if (isValidElement(child) && child.props.invalid) {
      return cloneElement(child, { className: cx(child.props.className, styles.invalidChild) });
    }

    return child;
  });

  return <div className={styles.root}>{modifiedChildren}</div>;
};

// The later in the array the higher the priority for showing that element's border
const borderPriority = [
  '' as const, // lowest priority
  'base' as const,
  'hovered' as const,
  'invalid' as const,
  'focused' as const, // highest priority
];

const getStyles = () => ({
  root: css({
    display: 'flex',

    // Style the direct children of the component
    '> *': {
      '&:not(:first-child)': {
        // Negative margin hides the double-border on adjacent selects
        marginLeft: -1,
      },

      '&:first-child': {
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
      },

      '&:last-child': {
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
      },

      '&:not(:first-child):not(:last-child)': {
        borderRadius: 0,
      },

      //
      position: 'relative',
      zIndex: borderPriority.indexOf('base'),

      // Adjacent borders are overlapping, so raise children up when hovering etc
      // so all that child's borders are visible.
      '&:hover': {
        zIndex: borderPriority.indexOf('hovered'),
      },
      '&:focus-within': {
        zIndex: borderPriority.indexOf('focused'),
      },
    },
  }),

  invalidChild: css({
    zIndex: borderPriority.indexOf('invalid'),
  }),
});
