import { css } from '@emotion/css';
import React, { FC, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, CollapsableSection, useStyles2 } from '@grafana/ui';
import { AlertmanagerGroup, Route } from 'app/plugins/datasource/alertmanager/types';

import { Authorize } from '../../components/Authorize';
import { FormAmRoute } from '../../types/amroutes';
import { getNotificationsPermissions } from '../../utils/access-control';
import { findMatchingAlertGroups } from '../../utils/notification-policies';
import { AlertGroup } from '../alert-groups/AlertGroup';
import { AmRouteReceiver } from '../receivers/grafanaAppReceivers/types';

import { AmRootRouteForm } from './AmRootRouteForm';
import { AmRootRouteRead } from './AmRootRouteRead';

export interface AmRootRouteProps {
  isEditMode: boolean;
  onEnterEditMode: () => void;
  onExitEditMode: () => void;
  onSave: (data: Partial<FormAmRoute>) => void;
  receivers: AmRouteReceiver[];
  routes: FormAmRoute;
  routeTree?: Route;
  alertManagerSourceName: string;
  readOnly?: boolean;
  alertGroups?: AlertmanagerGroup[];
}

export const AmRootRoute: FC<AmRootRouteProps> = ({
  isEditMode,
  onSave,
  onEnterEditMode,
  onExitEditMode,
  receivers,
  routes,
  routeTree = {},
  alertGroups = [],
  alertManagerSourceName,
  readOnly = false,
}) => {
  const styles = useStyles2(getStyles);

  const permissions = getNotificationsPermissions(alertManagerSourceName);

  const matchingAlertGroups = useMemo(() => {
    return findMatchingAlertGroups(routeTree, routeTree, alertGroups);
  }, [alertGroups, routeTree]);

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
      <CollapsableSection label="Show alert instances" isOpen={false}>
        {matchingAlertGroups.map((group, index) => (
          <AlertGroup key={index} alertManagerSourceName={alertManagerSourceName || ''} group={group} />
        ))}
      </CollapsableSection>
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
