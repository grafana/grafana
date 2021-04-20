import React, { FC, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { Button, useStyles } from '@grafana/ui';
import { Receiver, Route } from 'app/plugins/datasource/alertmanager/types';
import { AmRootRouteForm } from './AmRootRouteForm';
import { AmRootRouteRead } from './AmRootRouteRead';

export interface AmRootRouteProps {
  receivers: Array<SelectableValue<Receiver['name']>>;
  route: Route | undefined;
}

export const AmRootRoute: FC<AmRootRouteProps> = ({ receivers, route }) => {
  const styles = useStyles(getStyles);
  const [isEditMode, setIsEditMode] = useState(false);

  const toggleIsEditMode = () => {
    setIsEditMode(!isEditMode);
  };

  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>
        <h5 className={styles.title}>
          Root policy - <i>default for all alerts</i>
        </h5>
        {!isEditMode && (
          <Button icon="pen" onClick={toggleIsEditMode} size="sm" variant="secondary">
            Edit
          </Button>
        )}
      </div>
      <p>
        All alerts will go to the default notification channel, unless you set additional matchers in the specific
        routing area.
      </p>
      {isEditMode ? (
        <AmRootRouteForm onCancel={toggleIsEditMode} receivers={receivers} route={route} />
      ) : (
        <AmRootRouteRead route={route} />
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      background-color: ${theme.colors.bg2};
      color: ${theme.colors.textSemiWeak};
      padding: ${theme.spacing.md};
    `,
    titleContainer: css`
      color: ${theme.colors.textHeading};
      display: flex;
      flex-flow: row nowrap;
    `,
    title: css`
      flex: 100%;
    `,
  };
};
