import React, { FC, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, stylesFactory } from '@grafana/ui';
import { Route } from '../../../../../plugins/datasource/alertmanager/types';
import { AmRootRouteForm } from './AmRootRouteForm';
import { AmRootRouteRead } from './AmRootRouteRead';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      background-color: ${theme.palette.gray15};
      color: ${theme.palette.gray70};
      padding: ${theme.spacing.md};
    `,
    titleContainer: css`
      display: flex;
      flex-flow: row nowrap;
    `,
    title: css`
      flex: 100%;
    `,
    titleInfo: css`
      font-style: italic;
    `,
  };
});

export interface AmRootRouteProps {
  route: Route | undefined;
}

export const AmRootRoute: FC<AmRootRouteProps> = ({ route }) => {
  const styles = getStyles(config.theme);
  const [isEditMode, setIsEditMode] = useState(false);

  const toggleIsEditMode = () => {
    setIsEditMode(!isEditMode);
  };

  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>
        <h5 className={styles.title}>
          Root route - <span className={styles.titleInfo}>default for all alerts</span>
        </h5>
        {!isEditMode && (
          <Button icon="pen" onClick={toggleIsEditMode} size="sm" variant="secondary">
            Edit
          </Button>
        )}
      </div>
      <p>
        All alerts will go to the default notification channel , unless you set additional matchers in the specific
        routing area.
      </p>
      {isEditMode ? <AmRootRouteForm onCancel={toggleIsEditMode} route={route} /> : <AmRootRouteRead route={route} />}
    </div>
  );
};
