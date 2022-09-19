import { css, cx } from '@emotion/css';
import React from 'react';
import { Link } from 'react-router-dom';

import { GrafanaTheme2 } from '@grafana/data';
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
    <>
      <div className={cx(styles.heading, className)}>
        <div>
          <h4>{title}</h4>
          <p className={styles.description}>{description}</p>
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
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  heading: css`
    display: flex;
    justify-content: space-between;
  `,
  description: css`
    color: ${theme.colors.text.secondary};
  `,
});
