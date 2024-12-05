import {
  memo,
  FocusEvent,
  SyntheticEvent,
  useCallback,
  ReactNode,
  useMemo,
  cloneElement,
  isValidElement,
  MouseEvent,
} from 'react';

import { LogRowContextOptions, LogRowModel, getDefaultTimeRange, locationUtil, urlUtil } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { ClipboardButton, IconButton, PopoverContent } from '@grafana/ui';
import { getConfig } from 'app/core/config';

import { LogRowStyles } from './getLogRowStyles';

interface Props {
  logText: string;
  row: LogRowModel;
  showContextToggle?: (row: LogRowModel) => boolean;
  onOpenContext: (row: LogRowModel) => void;
  getRowContextQuery?: (
    row: LogRowModel,
    options?: LogRowContextOptions,
    cacheFilters?: boolean
  ) => Promise<DataQuery | null>;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  onPinLine?: (row: LogRowModel) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  pinLineButtonTooltipTitle?: PopoverContent;
  pinned?: boolean;
  styles: LogRowStyles;
  mouseIsOver: boolean;
  onBlur: () => void;
  onPinToContentOutlineClick?: (row: LogRowModel, onOpenContext: (row: LogRowModel) => void) => void;
  addonBefore?: ReactNode[];
  addonAfter?: ReactNode[];
}

export const LogRowMenuCell = memo(
  ({
    logText,
    onOpenContext,
    onPermalinkClick,
    onPinLine,
    onUnpinLine,
    pinLineButtonTooltipTitle,
    pinned,
    row,
    showContextToggle,
    styles,
    mouseIsOver,
    onBlur,
    getRowContextQuery,
    addonBefore,
    addonAfter,
  }: Props) => {
    const shouldShowContextToggle = useMemo(
      () => (showContextToggle ? showContextToggle(row) : false),
      [row, showContextToggle]
    );
    const onLogRowClick = useCallback((e: SyntheticEvent) => {
      e.stopPropagation();
    }, []);
    const onShowContextClick = useCallback(
      async (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        // if ctrl or meta key is pressed, open query in new Explore tab
        if (
          getRowContextQuery &&
          (event.nativeEvent.ctrlKey || event.nativeEvent.metaKey || event.nativeEvent.shiftKey)
        ) {
          const win = window.open('about:blank');
          // for this request we don't want to use the cached filters from a context provider, but always want to refetch and clear
          const query = await getRowContextQuery(row, undefined, false);
          if (query && win) {
            const url = urlUtil.renderUrl(locationUtil.assureBaseUrl(`${getConfig().appSubUrl}explore`), {
              left: JSON.stringify({
                datasource: query.datasource,
                queries: [query],
                range: getDefaultTimeRange(),
              }),
            });
            win.location = url;

            return;
          }
          win?.close();
        }
        onOpenContext(row);
      },
      [onOpenContext, getRowContextQuery, row]
    );
    /**
     * For better accessibility support, we listen to the onBlur event here (to hide this component), and
     * to onFocus in LogRow (to show this component).
     */
    const handleBlur = useCallback(
      (e: FocusEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget) && onBlur) {
          onBlur();
        }
      },
      [onBlur]
    );
    const getLogText = useCallback(() => logText, [logText]);

    const beforeContent = useMemo(() => {
      if (!addonBefore) {
        return null;
      }
      return addClickListenersToNode(addonBefore, row);
    }, [addonBefore, row]);

    const afterContent = useMemo(() => {
      if (!addonAfter) {
        return null;
      }
      return addClickListenersToNode(addonAfter, row);
    }, [addonAfter, row]);

    return (
      // We keep this click listener here to prevent the row from being selected when clicking on the menu.
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <span className={`log-row-menu ${styles.rowMenu}`} onClick={onLogRowClick} onBlur={handleBlur}>
        {pinned && !mouseIsOver && (
          <IconButton
            className={styles.unPinButton}
            size="md"
            name="gf-pin"
            onClick={() => onUnpinLine && onUnpinLine(row)}
            tooltip="Unpin line"
            tooltipPlacement="top"
            aria-label="Unpin line"
            tabIndex={0}
          />
        )}
        {mouseIsOver && (
          <>
            {beforeContent}
            {shouldShowContextToggle && (
              <IconButton
                size="md"
                name="gf-show-context"
                onClick={onShowContextClick}
                tooltip="Show context"
                tooltipPlacement="top"
                aria-label="Show context"
                tabIndex={0}
              />
            )}
            <ClipboardButton
              className={styles.copyLogButton}
              icon="copy"
              variant="secondary"
              fill="text"
              size="md"
              getText={getLogText}
              tooltip="Copy to clipboard"
              tooltipPlacement="top"
              tabIndex={0}
            />
            {pinned && onUnpinLine && (
              <IconButton
                className={styles.unPinButton}
                size="md"
                name="gf-pin"
                onClick={() => onUnpinLine && onUnpinLine(row)}
                tooltip="Unpin line"
                tooltipPlacement="top"
                aria-label="Unpin line"
                tabIndex={0}
              />
            )}
            {!pinned && onPinLine && (
              <IconButton
                className={styles.unPinButton}
                size="md"
                name="gf-pin"
                onClick={() => onPinLine && onPinLine(row)}
                tooltip={pinLineButtonTooltipTitle ?? 'Pin line'}
                tooltipPlacement="top"
                aria-label="Pin line"
                tabIndex={0}
              />
            )}
            {onPermalinkClick && row.rowId !== undefined && row.uid && (
              <IconButton
                tooltip="Copy shortlink"
                aria-label="Copy shortlink"
                tooltipPlacement="top"
                size="md"
                name="share-alt"
                onClick={() => onPermalinkClick(row)}
                tabIndex={0}
              />
            )}
            {afterContent}
          </>
        )}
      </span>
    );
  }
);

type AddonOnClickListener = (event: MouseEvent, row: LogRowModel) => void | undefined;
function addClickListenersToNode(nodes: ReactNode[], row: LogRowModel) {
  return nodes.map((node, index) => {
    if (isValidElement(node)) {
      const onClick: AddonOnClickListener = node.props.onClick;
      if (!onClick) {
        return node;
      }
      return cloneElement(node, {
        // @ts-expect-error
        onClick: (event: MouseEvent<HTMLElement>) => {
          onClick(event, row);
        },
        key: index,
      });
    }
    return node;
  });
}

LogRowMenuCell.displayName = 'LogRowMenuCell';
