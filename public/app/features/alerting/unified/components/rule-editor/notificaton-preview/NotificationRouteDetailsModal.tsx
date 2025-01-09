import { css, cx } from '@emotion/css';
import { compact } from 'lodash';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, Modal, Stack, useStyles2 } from '@grafana/ui';

import { Receiver } from '../../../../../../plugins/datasource/alertmanager/types';
import { AlertmanagerAction } from '../../../hooks/useAbilities';
import { AlertmanagerProvider } from '../../../state/AlertmanagerContext';
import { getAmMatcherFormatter } from '../../../utils/alertmanager';
import { MatcherFormatter } from '../../../utils/matchers';
import { createContactPointSearchLink } from '../../../utils/misc';
import { Authorize } from '../../Authorize';
import { Matchers } from '../../notification-policies/Matchers';

import { RouteWithPath, hasEmptyMatchers, isDefaultPolicy } from './route';

interface Props {
  routesByIdMap: Map<string, RouteWithPath>;
  route: RouteWithPath;
  matcherFormatter: MatcherFormatter;
}

function PolicyPath({ route, routesByIdMap, matcherFormatter }: Props) {
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
                <Matchers matchers={pathRoute.object_matchers ?? []} formatter={matcherFormatter} />
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

  return (
    <AlertmanagerProvider accessType="notification" alertmanagerSourceName={alertManagerSourceName}>
      <Modal
        className={styles.detailsModal}
        isOpen={true}
        title="Routing details"
        onDismiss={onClose}
        onClickBackdrop={onClose}
      >
        <Stack gap={0} direction="column">
          <div className={cx(styles.textMuted, styles.marginBottom(2))}>
            Your alert instances are routed as follows.
          </div>
          <div>Notification policy path</div>
          {isDefault && <div className={styles.textMuted}>Default policy</div>}
          <div className={styles.separator(1)} />
          {!isDefault && (
            <>
              <PolicyPath
                route={route}
                routesByIdMap={routesByIdMap}
                matcherFormatter={getAmMatcherFormatter(alertManagerSourceName)}
              />
            </>
          )}
          <div className={styles.separator(4)} />
          <div className={styles.contactPoint}>
            <Stack gap={1} direction="row" alignItems="center">
              Contact point:
              <span className={styles.textMuted}>{receiver.name}</span>
            </Stack>
            <Authorize actions={[AlertmanagerAction.UpdateContactPoint]}>
              <Stack gap={1} direction="row" alignItems="center">
                <a
                  href={createContactPointSearchLink(receiver.name, alertManagerSourceName)}
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
    </AlertmanagerProvider>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  textMuted: css({
    color: theme.colors.text.secondary,
  }),
  link: css({
    display: 'block',
    color: theme.colors.text.link,
  }),
  button: css({
    justifyContent: 'flex-end',
    display: 'flex',
  }),
  detailsModal: css({
    maxWidth: '560px',
  }),
  defaultPolicy: css({
    padding: theme.spacing(0.5),
    background: theme.colors.background.secondary,
    width: 'fit-content',
  }),
  contactPoint: css({
    display: 'flex',
    flexDirection: 'row',
    gap: theme.spacing(1),
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
  }),
  policyPathWrapper: css({
    display: 'flex',
    flexDirection: 'column',
    marginTop: theme.spacing(1),
  }),
  separator: (units: number) =>
    css({
      marginTop: theme.spacing(units),
    }),
  marginBottom: (units: number) =>
    css({
      marginBottom: theme.spacing(theme.spacing(units)),
    }),
  policyInPath: (index = 0, highlight = false) =>
    css({
      marginLeft: `${30 + index * 30}px`,
      padding: theme.spacing(1),
      marginTop: theme.spacing(1),
      border: `solid 1px ${highlight ? theme.colors.info.border : theme.colors.border.weak}`,
      background: theme.colors.background.secondary,
      width: 'fit-content',
      position: 'relative',
      '&:before': {
        content: '""',
        position: 'absolute',
        height: 'calc(100% - 10px)',
        width: theme.spacing(1),
        borderLeft: `solid 1px ${theme.colors.border.weak}`,
        borderBottom: `solid 1px ${theme.colors.border.weak}`,
        marginTop: theme.spacing(-2),
        marginLeft: `-17px`,
      },
    }),
});
