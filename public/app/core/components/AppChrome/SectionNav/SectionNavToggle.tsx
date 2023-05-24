import { css } from '@emotion/css';
import classnames from 'classnames';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useTheme2 } from '@grafana/ui';

export interface Props {
  isExpanded?: boolean;
  onClick: () => void;
}

export const SectionNavToggle = ({ isExpanded, onClick }: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <Button
      title={'Toggle section navigation'}
      aria-label={isExpanded ? 'Close section navigation' : 'Open section navigation'}
      icon="arrow-to-right"
      className={classnames(styles.icon, {
        [styles.iconExpanded]: isExpanded,
      })}
      variant="secondary"
      fill="text"
      size="md"
      onClick={onClick}
    />
  );
};

SectionNavToggle.displayName = 'SectionNavToggle';

const getStyles = (theme: GrafanaTheme2) => ({
  icon: css({
    alignSelf: 'center',
    margin: theme.spacing(1, 0),
    transform: 'rotate(90deg)',
    transition: theme.transitions.create('opacity'),
    color: theme.colors.text.secondary,
    zIndex: 1,

    [theme.breakpoints.up('md')]: {
      alignSelf: 'flex-start',
      position: 'relative',
      left: 0,
      margin: theme.spacing(0, 0, 0, 1),
      top: theme.spacing(2),
      transform: 'none',
    },

    'div:hover > &, &:focus': {
      opacity: 1,
    },
  }),
  iconExpanded: css({
    rotate: '180deg',

    [theme.breakpoints.up('md')]: {
      opacity: 0,
      margin: 0,
      position: 'absolute',
      right: 0,
      left: 'initial',
    },
  }),
});
