import React from 'react';

import { Dropdown } from '@grafana/ui';
import { Box } from '@grafana/ui/src/unstable';
import { DashNavButton } from 'app/features/dashboard/components/DashNav/DashNavButton';

import { PageHistoryPopover } from './PageHistoryPopover';

export interface Props {}

export function PageHistoryButton(props: Props) {
  return (
    <Dropdown overlay={() => <PageHistoryPopover />} placement="bottom">
      <Box marginLeft={1}>
        <DashNavButton icon="clock-nine" tooltip="Settings" />
      </Box>
    </Dropdown>
  );
}
