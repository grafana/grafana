import React from 'react';

import { Dropdown } from '@grafana/ui';
import { Box } from '@grafana/ui';
import { DashNavButton } from 'app/features/dashboard/components/DashNav/DashNavButton';

import { PageHistoryPopover } from './PageHistoryPopover';

export interface Props {}

export function PageHistoryButton(props: Props) {
  return (
    <Dropdown overlay={() => <PageHistoryPopover />} placement="bottom">
      <Box marginLeft={1}>
        <DashNavButton icon="history-alt" tooltip="Go back to a previous page" />
      </Box>
    </Dropdown>
  );
}
