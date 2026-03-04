import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2, Badge, Stack } from '@grafana/ui';
import { OrgUser } from 'app/types/user';

export interface Props {
  disabled?: boolean;
  user: OrgUser;
  onOpenDrawer: () => void;
}

export const RolePickerBadges = ({ disabled, user, onOpenDrawer }: Props) => {
  const { badge, badgeDisabled } = useStyles2(getStyles);
  const badgeStyle = disabled ? badgeDisabled : badge;

  const handleClick = () => {
    if (!disabled) {
      onOpenDrawer();
    }
  };

  return (
    <Stack gap={1}>
      <Badge className={badgeStyle} color="blue" onClick={handleClick} text={user.role} />
      {user.roles && user.roles.length > 0 && (
        <Badge
          className={badgeStyle}
          color="blue"
          onClick={handleClick}
          text={t('role-picker-drawer.user-count', '+{{numUsers}}', { numUsers: user.roles.length })}
        />
      )}
    </Stack>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    badge: css({
      cursor: 'pointer',
    }),
    badgeDisabled: css({
      cursor: 'not-allowed',
    }),
  };
}
