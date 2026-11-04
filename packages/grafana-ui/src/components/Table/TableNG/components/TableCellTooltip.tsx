import { css } from '@emotion/css';
import {
  type CSSProperties,
  type ReactElement,
  useMemo,
  useCallback,
  useId,
  useState,
  useRef,
  useEffect,
  memo,
  type RefObject,
} from 'react';

import { type ActionModel, type DataFrame, type Field, type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { type DataGridHandle } from '@grafana/react-data-grid';
import { type TableCellTooltipPlacement } from '@grafana/schema';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Popover } from '../../../Tooltip/Popover';
import { type TableCellOptions } from '../../types';
import { type getTooltipStyles } from '../styles';
import { type TableCellRenderer, type TableCellRendererProps, type TableWarning } from '../types';

import { TableWarningContent } from './TableWarnings';

export interface TableCellTooltipProps {
  cellOptions: TableCellOptions;
  children: ReactElement;
  classes: ReturnType<typeof getTooltipStyles>;
  className?: string;
  data: DataFrame;
  disableSanitizeHtml?: boolean;
  jsonSyntaxHighlightingEnabled?: boolean;
  tableRefreshEnabled?: boolean;
  field: Field;
  getActions: (field: Field, rowIdx: number) => ActionModel[];
  getTextColorForBackground: (bgColor: string) => string;
  gridRef: RefObject<DataGridHandle | null>;
  height: number;
  placement?: TableCellTooltipPlacement;
  renderer: TableCellRenderer;
  rowIdx: number;
  style?: CSSProperties;
  theme: GrafanaTheme2;
  width?: number;
  warnings?: readonly TableWarning[];
  showFieldContent?: boolean;
}

export const TableCellTooltip = memo(
  ({
    cellOptions,
    children,
    classes,
    className,
    data,
    disableSanitizeHtml,
    jsonSyntaxHighlightingEnabled,
    tableRefreshEnabled,
    field,
    getActions,
    getTextColorForBackground,
    gridRef,
    height,
    placement,
    renderer: CellRenderer,
    rowIdx,
    style,
    theme,
    width = 300,
    warnings = [],
    showFieldContent = true,
  }: TableCellTooltipProps) => {
    const rawValue = field.values[rowIdx];
    const hasFieldContent = showFieldContent && rawValue !== null && rawValue !== undefined && rawValue !== '';
    const hasWarnings = warnings.length > 0;
    const styles = useStyles2(getStyles);
    const tooltipCaretRef = useRef<HTMLDivElement>(null);
    const tooltipContentRef = useRef<HTMLDivElement>(null);
    const tooltipId = useId();

    const [hovered, setHovered] = useState(false);
    const [pinned, setPinned] = useState(false);
    const [focused, setFocused] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const hoverTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const show = !dismissed && (hovered || focused || pinned);
    const dismiss = useCallback(() => {
      clearTimeout(hoverTimeout.current);
      setPinned(false);
      setHovered(false);
      setFocused(false);
      setDismissed(true);
    }, []);

    useEffect(() => () => clearTimeout(hoverTimeout.current), []);

    useEffect(() => {
      if (pinned && hasFieldContent) {
        tooltipContentRef.current?.focus();
      }
    }, [pinned, hasFieldContent]);

    useEffect(() => {
      if (!show) {
        return;
      }
      const onEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          if (
            event.target instanceof Node &&
            (tooltipCaretRef.current?.contains(event.target) || tooltipContentRef.current?.contains(event.target))
          ) {
            event.stopPropagation();
            if (tooltipContentRef.current?.contains(event.target)) {
              tooltipCaretRef.current?.focus();
            }
          }
          dismiss();
        }
      };
      document.addEventListener('keydown', onEscape, true);
      return () => document.removeEventListener('keydown', onEscape, true);
    }, [show, dismiss]);

    useEffect(() => {
      if (!show) {
        return;
      }
      const onOutsideClick = (event: MouseEvent) => {
        if (!pinned && !tooltipContentRef.current?.contains(document.activeElement)) {
          return;
        }
        if (
          event.target instanceof Node &&
          (tooltipCaretRef.current?.contains(event.target) || tooltipContentRef.current?.contains(event.target))
        ) {
          return;
        }
        dismiss();
      };
      document.addEventListener('click', onOutsideClick, true);
      return () => document.removeEventListener('click', onOutsideClick, true);
    }, [show, pinned, dismiss]);

    useEffect(() => {
      if (pinned) {
        const gridRoot = gridRef.current?.element;

        // right now, we kill the pinned tooltip on any form of scrolling to avoid awkward rendering
        // where the tooltip bumps up against the edge of the scrollable container. we could try to
        // kill the tooltip when it hits these boundaries rather than when scrolling starts.
        const scrollListener = () => {
          if (tooltipContentRef.current?.contains(document.activeElement)) {
            tooltipCaretRef.current?.focus();
          }
          dismiss();
        };
        gridRoot?.addEventListener('scroll', scrollListener, { once: true });

        return () => {
          gridRoot?.removeEventListener('scroll', scrollListener);
        };
      }

      return;
    }, [pinned, gridRef, dismiss]);

    const rendererProps = useMemo(
      () =>
        ({
          cellInspect: false,
          cellOptions,
          disableSanitizeHtml,
          jsonSyntaxHighlightingEnabled,
          tableRefreshEnabled,
          field,
          frame: data,
          getActions,
          getTextColorForBackground,
          height,
          rowIdx,
          showFilters: false,
          theme,
          value: rawValue,
          width,
        }) satisfies TableCellRendererProps,
      [
        cellOptions,
        data,
        disableSanitizeHtml,
        jsonSyntaxHighlightingEnabled,
        tableRefreshEnabled,
        field,
        getActions,
        getTextColorForBackground,
        height,
        rawValue,
        rowIdx,
        theme,
        width,
      ]
    );

    const cellElement = tooltipCaretRef.current?.closest<HTMLElement>('.rdg-cell');

    if (!hasFieldContent && !hasWarnings) {
      return children;
    }

    const onMouseLeave = () => {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = setTimeout(() => setHovered(false), 100);
    };
    const onMouseEnter = () => {
      clearTimeout(hoverTimeout.current);
      setDismissed(false);
      setHovered(true);
    };
    const togglePinned = () => {
      if (pinned) {
        dismiss();
      } else {
        setDismissed(false);
        setPinned(true);
      }
    };

    return (
      <>
        {cellElement && (
          <Popover
            content={
              <div>
                {hasWarnings && (
                  <div className={styles.warnings}>
                    <TableWarningContent warnings={warnings} />
                  </div>
                )}
                {hasWarnings && hasFieldContent && <hr className={styles.divider} />}
                {hasFieldContent && (
                  <div className={className} style={hasWarnings ? style : undefined}>
                    <CellRenderer {...rendererProps} />
                  </div>
                )}
              </div>
            }
            show={show}
            placement={placement}
            wrapperClassName={classes.tooltipWrapper}
            style={{ ...(!hasWarnings && style), width: hasWarnings ? Math.max(width, 300) : width }}
            elementRef={tooltipContentRef}
            referenceElement={cellElement}
            onMouseLeave={onMouseLeave}
            onMouseEnter={onMouseEnter}
            onClick={(ev) => ev.stopPropagation()} // Keep preview clicks from activating the originating table cell.
            data-testid={selectors.components.Panels.Visualization.TableNG.Tooltip.Wrapper}
            role={hasFieldContent ? 'dialog' : 'tooltip'}
            aria-label={hasFieldContent ? t('grafana-ui.table.cell-preview', 'Cell preview') : undefined}
            tabIndex={hasFieldContent ? -1 : undefined}
            onFocus={() => setFocused(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setFocused(false);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Tab' && event.shiftKey && event.target === event.currentTarget) {
                event.preventDefault();
                tooltipCaretRef.current?.focus();
              }
            }}
            id={tooltipId}
          />
        )}

        <div
          className={classes.tooltipCaret}
          data-warning={hasWarnings}
          ref={tooltipCaretRef}
          data-testid={selectors.components.Panels.Visualization.TableNG.Tooltip.Caret}
          aria-label={
            hasWarnings
              ? t('grafana-ui.table.cell-warnings', 'Cell warnings')
              : t('grafana-ui.table.tooltip.trigger', 'Toggle tooltip')
          }
          role="button"
          aria-haspopup={hasFieldContent ? 'dialog' : undefined}
          aria-pressed={pinned}
          aria-expanded={hasFieldContent ? show : undefined}
          aria-controls={hasFieldContent && show ? tooltipId : undefined}
          aria-describedby={!hasFieldContent && show ? tooltipId : undefined}
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            togglePinned();
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseLeave={onMouseLeave}
          onMouseEnter={onMouseEnter}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
              ev.preventDefault();
              ev.stopPropagation();
              togglePinned();
            }
          }}
          onBlur={() => setFocused(false)}
          onFocus={() => {
            setDismissed(false);
            setFocused(true);
          }}
        />

        {children}
      </>
    );
  }
);
TableCellTooltip.displayName = 'TableCellTooltip';

const getStyles = (theme: GrafanaTheme2) => ({
  warnings: css({
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    whiteSpace: 'normal',
    textAlign: 'left',
  }),
  divider: css({
    border: 0,
    borderTop: `1px solid ${theme.colors.border.weak}`,
    margin: theme.spacing(1, 0),
  }),
});
