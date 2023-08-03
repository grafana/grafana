import { css, cx } from '@emotion/css';
import React from 'react';
import { Link } from 'react-router-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Button, Dropdown, Icon, Menu, MenuItem, useStyles2 } from '@grafana/ui';

interface Props {
  title: string;
  description: string;
  addButtonLabel: string;
  addButtonTo: string;
  className?: string;
  showButton?: boolean;
  exportLink?: string;
}

export const ReceiversSection = ({
  className,
  title,
  description,
  addButtonLabel,
  addButtonTo,
  children,
  showButton = true,
  exportLink,
}: React.PropsWithChildren<Props>) => {
  const styles = useStyles2(getStyles);
  const showMore = Boolean(exportLink);
  const newMenu = <Menu>{exportLink && <MenuItem url={exportLink} label="Export all" target="_blank" />}</Menu>;
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
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  heading: css`
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  `,
  description: css`
    color: ${theme.colors.text.secondary};
  `,
});
