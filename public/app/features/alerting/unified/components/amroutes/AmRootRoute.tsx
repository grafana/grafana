import React, { FC } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { Button, useStyles } from '@grafana/ui';
import { AmRouteReceiver, FormAmRoute } from '../../types/amroutes';
import { AmRootRouteForm } from './AmRootRouteForm';
import { AmRootRouteRead } from './AmRootRouteRead';

export interface AmRootRouteProps {
  isEditMode: boolean;
  onEnterEditMode: () => void;
  onExitEditMode: () => void;
  onSave: (data: Partial<FormAmRoute>) => void;
  receivers: AmRouteReceiver[];
  routes: FormAmRoute;
}

export const AmRootRoute: FC<AmRootRouteProps> = ({
  isEditMode,
  onSave,
  onEnterEditMode,
  onExitEditMode,
  receivers,
  routes,
}) => {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>
        <h5 className={styles.title}>
          Root policy - <i>default for all alerts</i>
        </h5>
        {!isEditMode && (
          <Button icon="pen" onClick={onEnterEditMode} size="sm" type="button" variant="secondary">
            Edit
          </Button>
        )}
      </div>
      <p>
        All alerts will go to the default notification channel, unless you set additional matchers in the specific
        routing area.
      </p>
      {isEditMode ? (
        <AmRootRouteForm onCancel={onExitEditMode} onSave={onSave} receivers={receivers} routes={routes} />
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
