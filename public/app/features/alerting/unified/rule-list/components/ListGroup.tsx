import { css } from '@emotion/css';
import { PropsWithChildren, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { Spacer } from '../../components/Spacer';

interface GroupProps extends PropsWithChildren {
  name: string;
  description?: ReactNode;
  metaRight?: ReactNode;
  actions?: ReactNode;
  isOpen?: boolean;
  onToggle: () => void;
}

export const Group = ({
  name,
  description,
  onToggle,
  isOpen = false,
  metaRight = null,
  actions = null,
  children,
}: GroupProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.groupWrapper} role="treeitem" aria-expanded={isOpen} aria-selected="false">
      <GroupHeader
        onToggle={onToggle}
        isOpen={isOpen}
        description={description}
        name={name}
        metaRight={metaRight}
        actions={actions}
      />
      {isOpen && <div role="group">{children}</div>}
    </div>
  );
};

const GroupHeader = (props: GroupProps) => {
  const { name, description, metaRight = null, actions = null, isOpen = false, onToggle } = props;

  const styles = useStyles2(getStyles);

  return (
    <div className={styles.headerWrapper}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Stack alignItems="center" gap={1}>
          <IconButton
            name={isOpen ? 'angle-right' : 'angle-down'}
            onClick={onToggle}
            aria-label={t('common.collapse', 'Collapse')}
          />
          <Text truncate variant="body">
            {name}
          </Text>
        </Stack>

        {description}
        <Spacer />
        {metaRight}
        {actions}
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  groupWrapper: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  headerWrapper: css({
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,

    background: theme.colors.background.secondary,

    border: 'none',
    borderBottom: `solid 1px ${theme.colors.border.weak}`,
    borderTopLeftRadius: theme.shape.radius.default,
    borderTopRightRadius: theme.shape.radius.default,
  }),
});
