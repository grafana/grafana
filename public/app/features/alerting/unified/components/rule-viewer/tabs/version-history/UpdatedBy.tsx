import { css } from '@emotion/css';

import { t } from '@grafana/i18n';
import { Badge, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { UpdatedBy } from 'app/types/unified-alerting-dto';

import { getSpecialUidsDisplayMap } from './versions-utils';

export const UpdatedByUser = ({ user }: { user: UpdatedBy | null | undefined }) => {
  const unknown = t('alerting.alertVersionHistory.unknown', 'Unknown');
  const SPECIAL_UID_MAP = getSpecialUidsDisplayMap();
  const styles = useStyles2(getStyles);

  const unknownCase = (
    <Tooltip
      content={t(
        'alerting.alertVersionHistory.unknown-change-description',
        'This update was made prior to the implementation of alert rule version history. The user who made the change is not tracked, but future changes will include the user'
      )}
    >
      <span>
        <span className={styles.underline}>{unknown} </span>
        <Icon name="question-circle" />
      </span>
    </Tooltip>
  );
  if (!user) {
    return unknownCase;
  }
  const specialCase = SPECIAL_UID_MAP[user.uid];
  if (specialCase || !user) {
    return (
      <Tooltip content={specialCase.tooltipContent}>
        <span>
          <Badge
            className={styles.badge}
            text={specialCase.name}
            color={specialCase.badgeColor}
            icon={specialCase.icon}
          />
        </span>
      </Tooltip>
    );
  }
  if (user.name) {
    return user.name;
  }
  if (user.uid) {
    return t('alerting.alertVersionHistory.user-id', 'User ID {{uid}}', { uid: user.uid });
  }
  return unknownCase;
};

const getStyles = () => {
  return {
    badge: css({ cursor: 'help' }),
    underline: css({
      textDecoration: 'underline dotted',
      textUnderlineOffset: '5px',
      cursor: 'help',
    }),
  };
};
