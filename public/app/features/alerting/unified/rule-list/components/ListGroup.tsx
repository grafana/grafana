import { css } from '@emotion/css';
import { type PropsWithChildren, type ReactNode } from 'react';
import { useToggle } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

import { Spacer } from '../../components/Spacer';

interface GroupProps extends PropsWithChildren {
  name: string;
  description?: ReactNode;
  metaRight?: ReactNode;
  actions?: ReactNode;
  isOpen?: boolean;
  href?: string;
}

export const ListGroup = ({
  name,
  description,
  isOpen = true,
  metaRight = null,
  actions = null,
  href,
  children,
}: GroupProps) => {
  const styles = useStyles2(getStyles);
  const [open, toggle] = useToggle(isOpen);

  return (
    <li className={styles.groupWrapper} role="treeitem" aria-expanded={open} aria-selected="false">
      <GroupHeader
        onToggle={() => toggle()}
        isOpen={open}
        description={description}
        name={name}
        metaRight={metaRight}
        actions={actions}
        href={href}
      />
      {open && (
        <div role="group" className={styles.childrenWrapper}>
          {children}
        </div>
      )}
    </li>
  );
};

type GroupHeaderProps = GroupProps & {
  onToggle: () => void;
};

const GroupHeader = (props: GroupHeaderProps) => {
  const { name, description, metaRight = null, actions = null, isOpen = false, onToggle, href } = props;

  const styles = useStyles2(getStyles);

  return (
    <div className={styles.headerWrapper}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Stack alignItems="center" gap={0.5}>
          <IconButton
            name={isOpen ? 'angle-down' : 'angle-right'}
            onClick={onToggle}
            aria-label={t('common.collapse', 'Collapse')}
          />
          {href ? (
            <TextLink href={href} color="primary" inline={false}>
              {name}
            </TextLink>
          ) : (
            <Text truncate variant="body" element="h4">
              {name}
            </Text>
          )}
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
    position: 'relative',
    listStyle: 'none',

    '&:before': {
      content: "''",
      position: 'absolute',
      height: '100%',
      left: theme.spacing(-1.5),
      borderLeft: `solid 1px ${theme.colors.border.weak}`,
    },
  }),
  headerWrapper: css({
    padding: theme.spacing(1, 1.5),
    position: 'relative',

    '&:hover': {
      background: theme.colors.action.hover,
      borderRadius: theme.shape.radius.default,
    },
  }),
  childrenWrapper: css({
    position: 'relative',
    paddingLeft: theme.spacing(2),
  }),
});
