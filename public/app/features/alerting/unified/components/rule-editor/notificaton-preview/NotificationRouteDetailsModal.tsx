import { css, cx } from '@emotion/css';
import { compact } from 'lodash';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, Modal, useStyles2 } from '@grafana/ui';

import { Receiver } from '../../../../../../plugins/datasource/alertmanager/types';
import { Stack } from '../../../../../../plugins/datasource/parca/QueryEditor/Stack';
import { getNotificationsPermissions } from '../../../utils/access-control';
import { makeAMLink } from '../../../utils/misc';
import { Authorize } from '../../Authorize';
import { Matchers } from '../../notification-policies/Matchers';

import { hasEmptyMatchers, isDefaultPolicy, RouteWithPath } from './route';

function PolicyPath({ route, routesByIdMap }: { routesByIdMap: Map<string, RouteWithPath>; route: RouteWithPath }) {
  const styles = useStyles2(getStyles);
  const routePathIds = route.path?.slice(1) ?? [];
  const routePathObjects = [...compact(routePathIds.map((id) => routesByIdMap.get(id))), route];

  return (
    <div className={styles.policyPathWrapper}>
      <div className={styles.defaultPolicy}>Default policy</div>
      {routePathObjects.map((pathRoute, index) => {
        return (
          <div key={pathRoute.id}>
            <div className={styles.policyInPath(index, index === routePathObjects.length - 1)}>
              {hasEmptyMatchers(pathRoute) ? (
                <div className={styles.textMuted}>No matchers</div>
              ) : (
                <Matchers matchers={pathRoute.object_matchers ?? []} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface NotificationRouteDetailsModalProps {
  onClose: () => void;
  route: RouteWithPath;
  receiver: Receiver;
  routesByIdMap: Map<string, RouteWithPath>;
  alertManagerSourceName: string;
}

export function NotificationRouteDetailsModal({
  onClose,
  route,
  receiver,
  routesByIdMap,
  alertManagerSourceName,
}: NotificationRouteDetailsModalProps) {
  const styles = useStyles2(getStyles);
  const isDefault = isDefaultPolicy(route);

  const permissions = getNotificationsPermissions(alertManagerSourceName);
  return (
    <Modal
      className={styles.detailsModal}
      isOpen={true}
      title="Routing details"
      onDismiss={onClose}
      onClickBackdrop={onClose}
    >
      <Stack gap={0} direction="column">
        <div className={cx(styles.textMuted, styles.marginBottom(2))}>Your alert instances are routed as follows.</div>
        <div>Notification policy path</div>
        {isDefault && <div className={styles.textMuted}>Default policy</div>}
        <div className={styles.separator(1)} />
        {!isDefault && (
          <>
            <PolicyPath route={route} routesByIdMap={routesByIdMap} />
          </>
        )}
        <div className={styles.separator(4)} />
        <div className={styles.contactPoint}>
          <Stack gap={1} direction="row" alignItems="center">
            Contact point:
            <span className={styles.textMuted}>{receiver.name}</span>
          </Stack>
          <Authorize actions={[permissions.update]}>
            <Stack gap={1} direction="row" alignItems="center">
              <a
                href={makeAMLink(
                  `/alerting/notifications/receivers/${encodeURIComponent(receiver.name)}/edit`,
                  alertManagerSourceName
                )}
                className={styles.link}
                target="_blank"
                rel="noreferrer"
              >
                See details <Icon name="external-link-alt" />
              </a>
            </Stack>
          </Authorize>
        </div>
        <div className={styles.button}>
          <Button variant="primary" type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </Stack>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  textMuted: css`
    color: ${theme.colors.text.secondary};
  `,
  link: css`
    display: block;
    color: ${theme.colors.text.link};
  `,
  button: css`
    justify-content: flex-end;
    display: flex;
  `,
  detailsModal: css`
    max-width: 560px;
  `,
  defaultPolicy: css`
    padding: ${theme.spacing(0.5)};
    background: ${theme.colors.background.secondary};
    width: fit-content;
  `,
  contactPoint: css`
    display: flex;
    flex-direction: row;
    gap: ${theme.spacing(1)};
    align-items: center;
    justify-content: space-between;
    margin-bottom: ${theme.spacing(1)};
  `,
  policyPathWrapper: css`
    display: flex;
    flex-direction: column;
    margin-top: ${theme.spacing(1)};
  `,
  separator: (units: number) => css`
    margin-top: ${theme.spacing(units)};
  `,
  marginBottom: (units: number) => css`
    margin-bottom: ${theme.spacing(theme.spacing(units))};
  `,
  policyInPath: (index = 0, higlight = false) => css`
    margin-left: ${30 + index * 30}px;
    padding: ${theme.spacing(1)};
    margin-top: ${theme.spacing(1)};
    border: solid 1px ${theme.colors.border.weak};
    background: ${theme.colors.background.secondary};
    width: fit-content;
    position: relative;

    ${
      higlight &&
      css`
        border: solid 1px ${theme.colors.info.border};
      `
    },
    &:before {
      content: '';
      position: absolute;
      height: calc(100% - 10px);
      width: ${theme.spacing(1)};
      border-left: solid 1px ${theme.colors.border.weak};
      border-bottom: solid 1px ${theme.colors.border.weak};
      margin-top: ${theme.spacing(-2)};
      margin-left: -17px;
    }
  }  `,
});
