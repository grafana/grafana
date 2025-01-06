import { css } from '@emotion/css';
import { PropsWithChildren, ReactNode } from 'react';
import { useToggle } from 'react-use';

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
}

export const ListGroup = ({
  name,
  description,
  isOpen = true,
  metaRight = null,
  actions = null,
  children,
}: GroupProps) => {
  const styles = useStyles2(getStyles);
  const [open, toggle] = useToggle(isOpen);

  return (
    <div className={styles.groupWrapper} role="treeitem" aria-expanded={open} aria-selected="false">
      <GroupHeader
        onToggle={() => toggle()}
        isOpen={open}
        description={description}
        name={name}
        metaRight={metaRight}
        actions={actions}
      />
      {open && <div role="group">{children}</div>}
    </div>
  );
};

type GroupHeaderProps = GroupProps & {
  onToggle: () => void;
};

const GroupHeader = (props: GroupHeaderProps) => {
  const { name, description, metaRight = null, actions = null, isOpen = false, onToggle } = props;

  const styles = useStyles2(getStyles);

  return (
    <div className={styles.headerWrapper}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Stack alignItems="center" gap={0}>
          <IconButton
            name={isOpen ? 'angle-down' : 'angle-right'}
            onClick={onToggle}
            aria-label={t('common.collapse', 'Collapse')}
          />
          <Text truncate variant="body" element="h4">
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
    padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,

    background: theme.colors.background.secondary,

    border: 'none',
    borderBottom: `solid 1px ${theme.colors.border.weak}`,
    borderTopLeftRadius: theme.shape.radius.default,
    borderTopRightRadius: theme.shape.radius.default,
  }),
});
