import { css } from '@emotion/css';
import classnames from 'classnames';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useTheme2 } from '@grafana/ui';

export interface Props {
  className?: string;
  isExpanded: boolean;
  onClick: () => void;
}

export const SectionNavToggle = ({ className, isExpanded, onClick }: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <Button
      title={'Toggle section navigation'}
      aria-label={isExpanded ? 'Close section navigation' : 'Open section navigation'}
      icon="arrow-to-right"
      className={classnames(className, styles.icon, {
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
    color: theme.colors.text.secondary,
    marginRight: 0,
    zIndex: 1,
  }),
  iconExpanded: css({
    rotate: '180deg',
  }),
});
