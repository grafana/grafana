import React, { FC } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
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
  alertManagerSourceName: string;
}

export const AmRootRoute: FC<AmRootRouteProps> = ({
  isEditMode,
  onSave,
  onEnterEditMode,
  onExitEditMode,
  receivers,
  routes,
  alertManagerSourceName,
}) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container} data-testid="am-root-route-container">
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
        All alerts will go to the default contact point, unless you set additional matchers in the specific routing
        area.
      </p>
      {isEditMode ? (
        <AmRootRouteForm
          alertManagerSourceName={alertManagerSourceName}
          onCancel={onExitEditMode}
          onSave={onSave}
          receivers={receivers}
          routes={routes}
        />
      ) : (
        <AmRootRouteRead routes={routes} />
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      background-color: ${theme.colors.background.secondary};
      color: ${theme.colors.text.secondary};
      padding: ${theme.spacing(2)};
    `,
    titleContainer: css`
      color: ${theme.colors.text.primary};
      display: flex;
      flex-flow: row nowrap;
    `,
    title: css`
      flex: 100%;
    `,
  };
};
