import React, { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Dropdown, Button, Icon } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { DashboardModel } from 'app/features/dashboard/state';

import AddPanelMenu from './AddPanelMenu';

export interface Props {
  dashboard: DashboardModel;
}

const AddPanelButton = ({ dashboard }: Props) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <Dropdown
      overlay={() => <AddPanelMenu dashboard={dashboard} />}
      placement="bottom"
      offset={[0, 6]}
      onVisibleChange={setIsMenuOpen}
    >
      <Button
        variant="secondary"
        size="sm"
        fill="outline"
        data-testid={selectors.components.PageToolbar.itemButton('Add button')}
      >
        <Trans i18nKey="dashboard.toolbar.add">Add</Trans>
        <Icon name={isMenuOpen ? 'angle-up' : 'angle-down'} size="lg" />
      </Button>
    </Dropdown>
  );
};

export default AddPanelButton;
