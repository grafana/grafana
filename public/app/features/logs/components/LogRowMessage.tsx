import { cx } from '@emotion/css';
import memoizeOne from 'memoize-one';
import React, { PureComponent } from 'react';
import Highlighter from 'react-highlight-words';

import { CoreApp, findHighlightChunksInText, LogRowModel } from '@grafana/data';
import { ClipboardButton, IconButton } from '@grafana/ui';

import { LogMessageAnsi } from './LogMessageAnsi';
import { LogRowStyles } from './getLogRowStyles';

export const MAX_CHARACTERS = 100000;

interface Props {
  row: LogRowModel;
  wrapLogMessage: boolean;
  prettifyLogMessage: boolean;
  app?: CoreApp;
  showContextToggle?: (row?: LogRowModel) => Promise<boolean>;
  onOpenContext: (row: LogRowModel) => void;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  styles: LogRowStyles;
}

function renderLogMessage(
  hasAnsi: boolean,
  entry: string,
  highlights: string[] | undefined,
  highlightClassName: string
) {
  const needsHighlighter =
    highlights && highlights.length > 0 && highlights[0] && highlights[0].length > 0 && entry.length < MAX_CHARACTERS;
  const searchWords = highlights ?? [];
  if (hasAnsi) {
    const highlight = needsHighlighter ? { searchWords, highlightClassName } : undefined;
    return <LogMessageAnsi value={entry} highlight={highlight} />;
  } else if (needsHighlighter) {
    return (
      <Highlighter
        textToHighlight={entry}
        searchWords={searchWords}
        findChunks={findHighlightChunksInText}
        highlightClassName={highlightClassName}
      />
    );
  } else {
    return entry;
  }
}

const restructureLog = memoizeOne((line: string, prettifyLogMessage: boolean): string => {
  if (prettifyLogMessage) {
    try {
      return JSON.stringify(JSON.parse(line), undefined, 2);
    } catch (error) {
      return line;
    }
  }
  return line;
});

export class LogRowMessage extends PureComponent<Props> {
  state = {
    showContext: false,
  };

  onShowContextClick = (e: React.SyntheticEvent<HTMLElement, Event>) => {
    const { onOpenContext } = this.props;
    e.stopPropagation();
    onOpenContext(this.props.row);
  };

  onLogRowClick = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  getLogText = () => {
    const { row, prettifyLogMessage } = this.props;
    const { raw } = row;
    return restructureLog(raw, prettifyLogMessage);
  };

  componentDidMount() {
    const { row, showContextToggle } = this.props;
    const shouldShowContextPromise = showContextToggle ? showContextToggle(row) : Promise.resolve(false);
    shouldShowContextPromise.then((shouldShowContext) => {
      this.setState({ showContext: shouldShowContext });
    });
  }

  render() {
    const { row, wrapLogMessage, prettifyLogMessage, styles, onPermalinkClick } = this.props;
    const { hasAnsi, raw } = row;
    const restructuredEntry = restructureLog(raw, prettifyLogMessage);

    return (
      <>
        {
          // When context is open, the position has to be NOT relative. // Setting the postion as inline-style to
          // overwrite the more sepecific style definition from `styles.logsRowMessage`.
        }
        <td className={styles.logsRowMessage}>
          <div
            className={cx(
              { [styles.positionRelative]: wrapLogMessage },
              { [styles.horizontalScroll]: !wrapLogMessage }
            )}
          >
            <button className={cx(styles.logLine, styles.positionRelative)}>
              {renderLogMessage(hasAnsi, restructuredEntry, row.searchWords, styles.logsRowMatchHighLight)}
            </button>
          </div>
        </td>
        <td className={cx('log-row-menu-cell', styles.logRowMenuCell)}>
          <span className={cx('log-row-menu', styles.rowMenu)} onClick={this.onLogRowClick}>
            {this.state.showContext && (
              <IconButton
                size="md"
                name="gf-show-context"
                onClick={this.onShowContextClick}
                tooltip="Show context"
                tooltipPlacement="top"
                aria-label="Show context"
              />
            )}
            <ClipboardButton
              className={styles.copyLogButton}
              icon="copy"
              variant="secondary"
              fill="text"
              size="md"
              getText={this.getLogText}
              tooltip="Copy to clipboard"
              tooltipPlacement="top"
            />
            {onPermalinkClick && row.uid && (
              <IconButton
                tooltip="Copy shortlink"
                aria-label="Copy shortlink"
                tooltipPlacement="top"
                size="md"
                name="share-alt"
                onClick={() => onPermalinkClick(row)}
              />
            )}
          </span>
        </td>
      </>
    );
  }
}
