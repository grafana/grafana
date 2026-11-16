import { css } from '@emotion/css';
import { type HTMLAttributes } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { getAccessibleTagColor, getAlertLabelColors } from '../../rules/components/labels/AlertLabel';

interface MatcherBadgeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'color'> {
  name: string;
  operator: string;
  value: string;
  /** what to pick the color from, defaults to the name */
  color?: string;
}

/**
 * Shows a label matcher (e.g. `team = operations`) as a single badge, colored the same way as an AlertLabel.
 */
const MatcherBadge = ({ name, operator, value, color, ...rest }: MatcherBadgeProps) => {
  const theme = useTheme2();
  const tagColors = getAccessibleTagColor(color ?? name, theme);
  // passing primitives keeps the memoization in useStyles2 effective
  const styles = useStyles2(getStyles, tagColors?.background, tagColors?.text);

  return (
    <div className={styles.wrapper} {...rest}>
      {`${name} ${operator} ${value}`}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, color?: string, textColor?: string) => {
  const { background, border, text } = getAlertLabelColors(theme, color, textColor);

  return {
    wrapper: css({
      display: 'inline-block',
      color: text,
      background,
      padding: theme.spacing(0.375, 1),
      fontSize: theme.typography.sm.fontSize,

      border: `solid 1px ${border}`,
      borderRadius: theme.shape.radius.pill,

      // Ensure we preserve whitespace, as otherwise it's not noticeable _at all_
      // when rendering the matcher, and is only noticeable when editing
      whiteSpace: 'pre',

      textOverflow: 'ellipsis',
      overflow: 'hidden',
    }),
  };
};

export { MatcherBadge };
