import { css } from '@emotion/css';
import classnames from 'classnames';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useTheme2 } from '@grafana/ui';

export interface Props {
  className?: string;
  isExpanded: boolean;
  onClick: () => void;
}

export const SectionNavToggle = ({ className, isExpanded, onClick }: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <IconButton
      tooltip={'Toggle section navigation'}
      aria-label={isExpanded ? 'Close section navigation' : 'Open section navigation'}
      name={isExpanded ? 'angle-left' : 'angle-right'}
      className={classnames(className, styles.icon)}
      size="xl"
      onClick={onClick}
    />
  );
};

SectionNavToggle.displayName = 'SectionNavToggle';

const getStyles = (theme: GrafanaTheme2) => ({
  icon: css({
    backgroundColor: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: '50%',
    marginRight: 0,
    zIndex: 1,
  }),
});
