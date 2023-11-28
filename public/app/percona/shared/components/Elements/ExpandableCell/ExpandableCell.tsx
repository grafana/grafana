import React, { FC } from 'react';

import { IconButton, useStyles } from '@grafana/ui';

import { getStyles } from './ExpandableCell.styles';
import { ExpandableCellProps } from './ExpandableCell.types';

export const ExpandableCell: FC<React.PropsWithChildren<ExpandableCellProps>> = ({
  row,
  value,
  collapsedIconName = 'arrow-down',
  expandedIconName = 'arrow-up',
}) => {
  const styles = useStyles(getStyles);
  const restProps = row.getToggleRowExpandedProps ? row.getToggleRowExpandedProps() : {};

  return (
    <div className={styles.expandableCellWrapper} {...restProps}>
      <span>{value}</span>
      {row.isExpanded ? (
        <IconButton tooltip="Hide details" data-testid="hide-details" size="xl" name={expandedIconName} />
      ) : (
        <IconButton tooltip="Show details" data-testid="show-details" size="xl" name={collapsedIconName} />
      )}
    </div>
  );
};
