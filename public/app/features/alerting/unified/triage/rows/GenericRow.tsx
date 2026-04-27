import { css, cx } from '@emotion/css';
import { type ReactNode, useEffect } from 'react';
import { useToggle } from 'react-use';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { t } from '@grafana/i18n';
import { IconButton, Stack } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { Spacer } from '../../components/Spacer';
import { useWorkbenchContext } from '../WorkbenchContext';

// Width of the md IconButton used as the expand/collapse chevron, in pixels.
const CHEVRON_WIDTH_PX = 24;

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
  showIndentBorder?: boolean; // draw a left border when depth > 0 (leaf rows only)
  /**
   * When false, expand-all signals from WorkbenchContext are ignored.
   * Use this for rows whose children should not be auto-expanded (e.g. AlertRuleRow instance list).
   */
  expandable?: boolean;
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
  showIndentBorder = false,
  expandable = true,
}: GenericRowProps) => {
  const styles = useStyles2(getStyles);
  const { expandGeneration, collapseGeneration } = useWorkbenchContext();

  const hasChildren = Boolean(children);

  // Compute the effective initial state: honour expand/collapse signals that were
  // already active when this row mounted (e.g. a parent just opened revealing us).
  const effectiveInitialOpen = (() => {
    if (collapseGeneration > 0) {
      return false;
    }
    if (expandGeneration > 0 && expandable) {
      return true;
    }
    return isOpenByDefault;
  })();

  const [isOpen, handleToggle] = useToggle(effectiveInitialOpen);

  // Respond to expand-all / collapse-all signals for already-mounted rows.
  useEffect(() => {
    if (expandGeneration > 0 && expandable && hasChildren && !isOpen) {
      handleToggle(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandGeneration]);

  useEffect(() => {
    if (collapseGeneration > 0 && hasChildren && isOpen) {
      handleToggle(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapseGeneration]);

  const showChildContent = isOpen && hasChildren;

  return (
    <>
      <div
        className={cx(
          styles.groupItemWrapper(width, depth, showIndentBorder),
          depth > 0 && styles.indented(depth),
          depth > 0 && showIndentBorder && styles.indentBorder
        )}
      >
        <div className={cx(styles.leftColumn, styles.column, leftColumnClassName)}>
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
        <div className={cx(styles.rightColumnWrapper, styles.column, rightColumnClassName)}>
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
      {onToggle ? (
        <IconButton
          name={isOpen ? 'angle-down' : 'angle-right'}
          onClick={onToggle}
          className={styles.dropdownIcon}
          variant="secondary"
          size="md"
          aria-label={t('alerting.group-wrapper.toggle', 'Toggle group')}
        />
      ) : (
        <div className={styles.chevronPlaceholder} />
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
    }),
    leftColumn: css({
      overflow: 'hidden',
    }),
    rightColumnWrapper: css({
      minWidth: 'min-content',
      flexGrow: 1,
    }),
    columnContent: css({
      padding: 5,
      width: '100%',
    }),
    groupItemWrapper: (width: number, depth: number, showIndentBorder: boolean) => {
      const offsetPx =
        depth > 0 ? depth * 2 * theme.spacing.gridSize + (showIndentBorder ? theme.spacing.gridSize : 0) : 0;
      return css({
        display: 'grid',
        gridTemplateColumns: `${Math.max(0, width - offsetPx)}px auto`,
        gap: theme.spacing(2),
      });
    },
    indented: (depth: number) =>
      css({
        marginLeft: theme.spacing(depth * 2),
      }),
    indentBorder: css({
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      paddingLeft: theme.spacing(1),
    }),
    chevronPlaceholder: css({
      width: CHEVRON_WIDTH_PX,
      flexShrink: 0,
    }),
  };
};
