import React, { useCallback, useState } from 'react';
// import { useAsyncFn } from 'react-use';

import { Button, ButtonGroup, Dropdown, Icon } from '@grafana/ui';

import { DashboardScene } from '../../scene/DashboardScene';

import ExportMenu from './ExportMenu';

export default function ExportButton({ dashboard }: { dashboard: DashboardScene }) {
  const [isOpen, setIsOpen] = useState(false);

  const onMenuClick = useCallback((isOpen: boolean) => {
    setIsOpen(isOpen);
  }, []);

  const MenuActions = () => <ExportMenu dashboard={dashboard} />;

  return (
    <ButtonGroup>
      <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={onMenuClick}>
        <Button size="sm" variant="secondary" fill="solid" tooltip="Export">
          Export
          <Icon name={isOpen ? 'angle-up' : 'angle-down'} size="lg" />
        </Button>
      </Dropdown>
    </ButtonGroup>
  );
}
