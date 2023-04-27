import { css, cx } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Dropdown, Button, useTheme2, Icon } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { DashboardModel } from 'app/features/dashboard/state';

import { AddPanelMenu } from './AddPanelMenu';

interface Props {
  dashboard: DashboardModel;
}

export const AddPanelButton = ({ dashboard }: Props) => {
  const styles = getStyles(useTheme2());
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <Dropdown
      overlay={() => <AddPanelMenu dashboard={dashboard} />}
      placement="bottom"
      offset={[0, 6]}
      onVisibleChange={setIsMenuOpen}
    >
      <Button
        icon="panel-add"
        size="lg"
        fill="outline"
        className={cx(styles.button, styles.buttonIcon, styles.buttonText)}
        data-testid={selectors.components.PageToolbar.itemButton('Add panel button')}
      >
        <Trans i18nKey="dashboard.toolbar.add">Add</Trans>
        <Icon name={isMenuOpen ? 'angle-up' : 'angle-down'} size="lg" />
      </Button>
    </Dropdown>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    button: css({
      label: 'add-panel-button',
      padding: theme.spacing(0.5, 0.5, 0.5, 0.75),
      height: theme.spacing((theme.components.height.sm + theme.components.height.md) / 2),
      borderRadius: theme.shape.radius.default,
    }),
    buttonIcon: css({
      svg: {
        margin: 0,
      },
    }),
    buttonText: css({
      label: 'add-panel-button-text',
      fontSize: theme.typography.body.fontSize,
      span: {
        marginLeft: theme.spacing(0.67),
      },
    }),
  };
}
