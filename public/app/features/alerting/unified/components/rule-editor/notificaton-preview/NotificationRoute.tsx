import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import pluralize from 'pluralize';
import { useState } from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, TagList, getTagColorIndexFromName, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { Receiver } from '../../../../../../plugins/datasource/alertmanager/types';
import { Stack } from '../../../../../../plugins/datasource/parca/QueryEditor/Stack';
import { getAmMatcherFormatter } from '../../../utils/alertmanager';
import { AlertInstanceMatch } from '../../../utils/notification-policies';
import { CollapseToggle } from '../../CollapseToggle';
import { MetaText } from '../../MetaText';
import { Spacer } from '../../Spacer';

import { NotificationPolicyMatchers } from './NotificationPolicyMatchers';
import { NotificationRouteDetailsModal } from './NotificationRouteDetailsModal';
import { RouteWithPath } from './route';

function NotificationRouteHeader({
  route,
  receiver,
  routesByIdMap,
  instancesCount,
  alertManagerSourceName,
  expandRoute,
  onExpandRouteClick,
}: {
  route: RouteWithPath;
  receiver: Receiver;
  routesByIdMap: Map<string, RouteWithPath>;
  instancesCount: number;
  alertManagerSourceName: string;
  expandRoute: boolean;
  onExpandRouteClick: (expand: boolean) => void;
}) {
  const styles = useStyles2(getStyles);
  const [showDetails, setShowDetails] = useState(false);

  const onClickDetails = () => {
    setShowDetails(true);
  };

  // @TODO: re-use component ContactPointsHoverDetails from Policy once we have it for cloud AMs.

  return (
    <div className={styles.routeHeader}>
      <CollapseToggle
        isCollapsed={!expandRoute}
        onToggle={(isCollapsed) => onExpandRouteClick(!isCollapsed)}
        aria-label={t('alerting.notification-route-header.aria-label-expand-policy-route', 'Expand policy route')}
      />

      <Stack flexGrow={1} gap={1}>
        {/* TODO: fix keyboard a11y */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div onClick={() => onExpandRouteClick(!expandRoute)} className={styles.expandable}>
          <Stack gap={1} direction="row" alignItems="center">
            Notification policy
            <NotificationPolicyMatchers
              route={route}
              matcherFormatter={getAmMatcherFormatter(alertManagerSourceName)}
            />
          </Stack>
        </div>
        <Spacer />
        <Stack gap={2} direction="row" alignItems="center">
          <MetaText icon="layers-alt" data-testid="matching-instances">
            {instancesCount ?? '-'} {pluralize('instance', instancesCount)}
          </MetaText>
          <Stack gap={1} direction="row" alignItems="center">
            <div>
              <span className={styles.textMuted}>
                <Trans i18nKey="alerting.notification-route-header.delivered-to">@ Delivered to</Trans>
              </span>{' '}
              {receiver.name}
            </div>

            <div className={styles.verticalBar} />

            <Button type="button" onClick={onClickDetails} variant="secondary" fill="outline" size="sm">
              <Trans i18nKey="alerting.notification-route-header.see-details">See details</Trans>
            </Button>
          </Stack>
        </Stack>
      </Stack>
      {showDetails && (
        <NotificationRouteDetailsModal
          onClose={() => setShowDetails(false)}
          route={route}
          receiver={receiver}
          routesByIdMap={routesByIdMap}
          alertManagerSourceName={alertManagerSourceName}
        />
      )}
    </div>
  );
}

interface NotificationRouteProps {
  route: RouteWithPath;
  receiver: Receiver;
  instanceMatches: AlertInstanceMatch[];
  routesByIdMap: Map<string, RouteWithPath>;
  alertManagerSourceName: string;
}

export function NotificationRoute({
  route,
  instanceMatches,
  receiver,
  routesByIdMap,
  alertManagerSourceName,
}: NotificationRouteProps) {
  const styles = useStyles2(getStyles);
  const [expandRoute, setExpandRoute] = useToggle(false);
  // @TODO: The color index might be updated at some point in the future.Maybe we should roll our own tag component,
  // one that supports a custom function to define the color and allow manual color overrides
  const GREY_COLOR_INDEX = 9;

  return (
    <div data-testid="matching-policy-route">
      <NotificationRouteHeader
        route={route}
        receiver={receiver}
        routesByIdMap={routesByIdMap}
        instancesCount={instanceMatches.length}
        alertManagerSourceName={alertManagerSourceName}
        expandRoute={expandRoute}
        onExpandRouteClick={setExpandRoute}
      />
      {expandRoute && (
        <Stack gap={1} direction="column">
          <div className={styles.routeInstances} data-testid="route-matching-instance">
            {instanceMatches.map((instanceMatch) => {
              const matchArray = Array.from(instanceMatch.labelsMatch);
              const matchResult = matchArray.map(([label, matchResult]) => ({
                label: `${label[0]}=${label[1]}`,
                match: matchResult.match,
                colorIndex: matchResult.match ? getTagColorIndexFromName(label[0]) : GREY_COLOR_INDEX,
              }));

              const matchingLabels = matchResult.filter((mr) => mr.match);
              const nonMatchingLabels = matchResult.filter((mr) => !mr.match);

              return (
                <div className={styles.tagListCard} key={uniqueId()}>
                  {matchArray.length > 0 ? (
                    <>
                      {matchingLabels.length > 0 ? (
                        <TagList
                          tags={matchingLabels.map((mr) => mr.label)}
                          className={styles.labelList}
                          getColorIndex={(_, index) => matchingLabels[index].colorIndex}
                        />
                      ) : (
                        <div className={cx(styles.textMuted, styles.textItalic)}>
                          <Trans i18nKey="alerting.notification-route.no-matching-labels">No matching labels</Trans>
                        </div>
                      )}
                      <div className={styles.labelSeparator} />
                      <TagList
                        tags={nonMatchingLabels.map((mr) => mr.label)}
                        className={styles.labelList}
                        getColorIndex={(_, index) => nonMatchingLabels[index].colorIndex}
                      />
                    </>
                  ) : (
                    <div className={styles.textMuted}>
                      <Trans i18nKey="alerting.notification-route.no-labels">No labels</Trans>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Stack>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  textMuted: css({
    color: theme.colors.text.secondary,
  }),
  textItalic: css({
    fontStyle: 'italic',
  }),
  expandable: css({
    cursor: 'pointer',
  }),
  routeHeader: css({
    display: 'flex',
    flexDirection: 'row',
    gap: theme.spacing(1),
    alignItems: 'center',
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(0.5, 0.5, 0.5, 0),
    '&:hover': {
      backgroundColor: theme.components.table.rowHoverBackground,
    },
  }),
  labelList: css({
    flex: '0 1 auto',
    justifyContent: 'flex-start',
  }),
  labelSeparator: css({
    width: '1px',
    backgroundColor: theme.colors.border.weak,
  }),
  tagListCard: css({
    display: 'flex',
    flexDirection: 'row',
    gap: theme.spacing(2),

    position: 'relative',
    background: theme.colors.background.secondary,
    padding: theme.spacing(1),

    borderRadius: theme.shape.borderRadius(2),
    border: `solid 1px ${theme.colors.border.weak}`,
  }),
  routeInstances: css({
    padding: theme.spacing(1, 0, 1, 4),
    position: 'relative',

    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),

    '&:before': {
      content: '""',
      position: 'absolute',
      left: theme.spacing(2),
      height: `calc(100% - ${theme.spacing(2)})`,
      width: theme.spacing(4),
      borderLeft: `solid 1px ${theme.colors.border.weak}`,
    },
  }),
  verticalBar: css({
    width: '1px',
    height: '20px',
    backgroundColor: theme.colors.secondary.main,
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  }),
});
