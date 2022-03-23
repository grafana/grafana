import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import React, { FC } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  title: string;
  description: string;
  addButtonLabel: string;
  addButtonTo: string;
  className?: string;
  showButton?: boolean;
}

export const ReceiversSection: FC<Props> = ({
  className,
  title,
  description,
  addButtonLabel,
  addButtonTo,
  children,
  showButton = true,
}) => {
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
            <Button icon="plus">{addButtonLabel}</Button>
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
