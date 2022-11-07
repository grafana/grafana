import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';

import { Authorize } from '../../components/Authorize';
import { AmRouteReceiver, FormAmRoute } from '../../types/amroutes';
import { getNotificationsPermissions } from '../../utils/access-control';

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
  readOnly?: boolean;
}

export const AmRootRoute: FC<AmRootRouteProps> = ({
  isEditMode,
  onSave,
  onEnterEditMode,
  onExitEditMode,
  receivers,
  routes,
  alertManagerSourceName,
  readOnly = false,
}) => {
  const styles = useStyles2(getStyles);

  const permissions = getNotificationsPermissions(alertManagerSourceName);

  return (
    <div className={styles.container} data-testid="am-root-route-container">
      <div className={styles.titleContainer}>
        <h5 className={styles.title}>
          Root policy - <i>default for all alerts</i>
        </h5>
        {!isEditMode && !readOnly && (
          <Authorize actions={[permissions.update]}>
            <Button icon="pen" onClick={onEnterEditMode} size="sm" type="button" variant="secondary">
              Edit
            </Button>
          </Authorize>
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
