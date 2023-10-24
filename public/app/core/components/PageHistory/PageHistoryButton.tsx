import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Dropdown, useStyles2 } from '@grafana/ui';
import { Box } from '@grafana/ui/src/unstable';
import { DashNavButton } from 'app/features/dashboard/components/DashNav/DashNavButton';

import { PageHistoryPopover } from './PageHistoryPopover';

export interface Props {}

export function PageHistoryButton(props: Props) {
  const styles = useStyles2(getStyles);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dropdown overlay={() => <PageHistoryPopover />} placement="bottom" onVisibleChange={setIsOpen}>
      <Box marginLeft={1}>
        <DashNavButton icon="clock-nine" tooltip="Settings" />
      </Box>
    </Dropdown>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    popover: css({
      display: 'flex',
      padding: theme.spacing(2),
      flexDirection: 'column',
      background: theme.colors.background.primary,
      boxShadow: theme.shadows.z3,
      borderRadius: theme.shape.borderRadius(),
      border: `1px solid ${theme.colors.border.weak}`,
      zIndex: 1,
      marginRight: theme.spacing(2),
    }),
    heading: css({
      fontWeight: theme.typography.fontWeightMedium,
      paddingBottom: theme.spacing(2),
    }),
    options: css({
      display: 'grid',
      gridTemplateColumns: '1fr 50px',
      rowGap: theme.spacing(1),
      columnGap: theme.spacing(2),
    }),
  };
};
