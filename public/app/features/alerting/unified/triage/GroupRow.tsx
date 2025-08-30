import { css, cx } from '@emotion/css';
import { ReactNode } from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Stack, useStyles2 } from '@grafana/ui';

import { Spacer } from '../components/Spacer';

interface GroupRowProps {
  width: number;
  title: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  content?: ReactNode;
  children?: ReactNode;
}

export const GroupRow = ({ width, title, metadata, actions, content, children }: GroupRowProps) => {
  const styles = useStyles2(getStyles);
  const [isOpen, handleToggle] = useToggle(false);

  const hasChildren = Boolean(children);
  const showChildContent = isOpen && hasChildren;

  return (
    <>
      <div className={styles.groupItemWrapper(width)}>
        <div className={cx(styles.leftColumn, styles.column)}>
          <div className={styles.columnContent}>
            <LeftCell
              title={title}
              metadata={metadata}
              actions={actions}
              isOpen={isOpen}
              onToggle={hasChildren ? handleToggle : undefined}
            />
          </div>
        </div>
        <div style={{ minWidth: 'min-content', flexGrow: 1 }} className={cx(styles.rightColumn, styles.column)}>
          {content && <div className={styles.columnContent}>{content}</div>}
        </div>
      </div>
      {showChildContent ? children : null}
    </>
  );
};

interface LeftCellProps {
  title: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
}

const LeftCell = ({ title, metadata = null, actions = null, isOpen = true, onToggle }: LeftCellProps) => {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      {onToggle && (
        <IconButton
          name={isOpen ? 'angle-down' : 'angle-right'}
          onClick={() => onToggle()}
          className={styles.dropdownIcon}
          variant="secondary"
          size="md"
          aria-label={t('alerting.group-wrapper.toggle', 'Toggle group')}
        />
      )}
      <Stack direction="column" alignItems="flex-start" gap={0} flex={1}>
        <Stack direction="row" alignItems="center" gap={1} width="100%">
          {title}
          <Spacer />
          {actions}
        </Stack>
        {metadata}
      </Stack>
    </Stack>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    dropdownIcon: css({
      alignSelf: 'flex-start',
      marginTop: theme.spacing(0.5),
    }),
    column: css({
      display: 'flex',
      position: 'relative',
      flexBasis: 0,
      border: 'solid 1px transparent',
      borderBottom: `1px solid ${theme.colors.border.medium}`,
    }),
    leftColumn: css({
      // background: `rgba(0, 0, 255, 0.1)`,
    }),
    rightColumn: css({
      // background: `rgba(255, 0, 0, 0.1)`,
    }),
    columnContent: css({
      padding: 5,
      width: '100%',
    }),
    groupItemWrapper: (width: number) =>
      css({
        display: 'grid',
        gridTemplateColumns: `${width}px auto`,
        gap: theme.spacing(2),
      }),
  };
};
