import React, { FC, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { Button, useStyles } from '@grafana/ui';
import { Receiver } from 'app/plugins/datasource/alertmanager/types';
import { AmRouteFormValues } from '../../types/amroutes';
import { AmRootRouteForm } from './AmRootRouteForm';
import { AmRootRouteRead } from './AmRootRouteRead';

export interface AmRootRouteProps {
  receivers: Array<SelectableValue<Receiver['name']>>;
  routes: AmRouteFormValues;
}

export const AmRootRoute: FC<AmRootRouteProps> = ({ receivers, routes }) => {
  const styles = useStyles(getStyles);
  const [isEditMode, setIsEditMode] = useState(false);

  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>
        <h5 className={styles.title}>
          Root policy - <i>default for all alerts</i>
        </h5>
        {!isEditMode && (
          <Button icon="pen" onClick={() => setIsEditMode(true)} size="sm" type="button" variant="secondary">
            Edit
          </Button>
        )}
      </div>
      <p>
        All alerts will go to the default notification channel, unless you set additional matchers in the specific
        routing area.
      </p>
      {isEditMode ? (
        <AmRootRouteForm onCancel={() => setIsEditMode(false)} receivers={receivers} routes={routes} />
      ) : (
        <AmRootRouteRead routes={routes} />
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
