import { css, cx } from '@emotion/css';
import { ReactNode } from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Stack, useStyles2 } from '@grafana/ui';

import { Spacer } from '../../components/Spacer';

interface GenericRowProps {
  width: number;
  title: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  content?: ReactNode;
  isOpenByDefault?: boolean;
  children?: ReactNode;
  // allow overriding / adding styles for the row
  leftColumnClassName?: string;
  rightColumnClassName?: string;
  depth?: number; // for indentation of nested rows
}

export const GenericRow = ({
  width,
  title,
  metadata,
  actions,
  content,
  isOpenByDefault = false,
  children,
  leftColumnClassName,
  rightColumnClassName,
  depth = 0,
}: GenericRowProps) => {
  const styles = useStyles2(getStyles);
  const [isOpen, handleToggle] = useToggle(isOpenByDefault);

  const hasChildren = Boolean(children);
  const showChildContent = isOpen && hasChildren;

  return (
    <>
      <div className={styles.groupItemWrapper(width)}>
        <div className={cx(styles.leftColumn, styles.column, leftColumnClassName)}>
          <div className={styles.columnContent(depth)}>
            <LeftCell
              title={title}
              metadata={metadata}
              actions={actions}
              isOpen={isOpen}
              onToggle={hasChildren ? handleToggle : undefined}
            />
          </div>
        </div>
        <div style={{ minWidth: 'min-content', flexGrow: 1 }} className={cx(styles.column, rightColumnClassName)}>
          {content && <div className={styles.columnContent()}>{content}</div>}
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
          {actions && <Spacer />}
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
      border: `1px solid ${theme.colors.border.medium}`,
    }),
    leftColumn: css({
      overflow: 'hidden',
    }),
    columnContent: (depth?: number) =>
      css({
        padding: 5,
        width: '100%',
        paddingLeft: depth ? `calc(${theme.spacing(depth)} + 5px)` : 5,
      }),
    groupItemWrapper: (width: number) =>
      css({
        display: 'grid',
        gridTemplateColumns: `${width}px auto`,
        gap: theme.spacing(2),
      }),
  };
};
