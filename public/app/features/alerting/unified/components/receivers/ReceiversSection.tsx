import { css, cx } from '@emotion/css';
import * as React from 'react';
import { Link } from 'react-router-dom-v5-compat';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Dropdown, Icon, Menu, MenuItem, Stack, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { GrafanaReceiversExporter } from '../export/GrafanaReceiversExporter';

interface Props {
  title: string;
  description: string;
  addButtonLabel: string;
  addButtonTo: string;
  className?: string;
  showButton?: boolean;
  canReadSecrets?: boolean;
  showExport?: boolean;
}

export const ReceiversSection = ({
  className,
  title,
  description,
  addButtonLabel,
  addButtonTo,
  children,
  showButton = true,
  canReadSecrets = false,
  showExport = false,
}: React.PropsWithChildren<Props>) => {
  const styles = useStyles2(getStyles);
  const showMore = showExport;
  const [showExportDrawer, toggleShowExportDrawer] = useToggle(false);

  const newMenu = (
    <Menu>
      {showExport && (
        <MenuItem
          onClick={toggleShowExportDrawer}
          label={t('alerting.receivers-section.new-menu.label-export-all', 'Export all')}
        />
      )}
    </Menu>
  );

  return (
    <Stack direction="column" gap={2}>
      <div className={cx(styles.heading, className)}>
        <div>
          <h4>{title}</h4>
          <div className={styles.description}>{description}</div>
        </div>
        <Stack direction="row" gap={0.5}>
          {showButton && (
            <Link to={addButtonTo}>
              <Button type="button" icon="plus">
                {addButtonLabel}
              </Button>
            </Link>
          )}
          {showMore && (
            <Dropdown overlay={newMenu}>
              <Button variant="secondary">
                More
                <Icon name="angle-down" />
              </Button>
            </Dropdown>
          )}
        </Stack>
      </div>
      {children}
      {showExportDrawer && <GrafanaReceiversExporter decrypt={canReadSecrets} onClose={toggleShowExportDrawer} />}
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  heading: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  }),
  description: css({
    color: theme.colors.text.secondary,
  }),
});
