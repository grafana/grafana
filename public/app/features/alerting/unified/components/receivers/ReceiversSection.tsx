import { css, cx } from '@emotion/css';
import React from 'react';
import { Link } from 'react-router-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Button, useStyles2 } from '@grafana/ui';

interface Props {
  title: string;
  description: string;
  addButtonLabel: string;
  addButtonTo: string;
  className?: string;
  showButton?: boolean;
}

export const ReceiversSection = ({
  className,
  title,
  description,
  addButtonLabel,
  addButtonTo,
  children,
  showButton = true,
}: React.PropsWithChildren<Props>) => {
  const styles = useStyles2(getStyles);
  return (
    <Stack direction="column" gap={2}>
      <div className={cx(styles.heading, className)}>
        <div>
          <h4>{title}</h4>
          <div className={styles.description}>{description}</div>
        </div>
        {showButton && (
          <Link to={addButtonTo}>
            <Button type="button" icon="plus">
              {addButtonLabel}
            </Button>
          </Link>
        )}
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
