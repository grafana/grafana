import React, { PureComponent } from 'react';
import { isEqual } from 'lodash';
import tinycolor from 'tinycolor2';
import { css, cx } from '@emotion/css';
import { LogRowModel, findHighlightChunksInText, GrafanaTheme } from '@grafana/data';
import memoizeOne from 'memoize-one';

// @ts-ignore
import Highlighter from 'react-highlight-words';
import { LogRowContextQueryErrors, HasMoreContextRows, LogRowContextRows } from './LogRowContextProvider';
import { Themeable } from '../../types/theme';
import { withTheme } from '../../themes/index';
import { getLogRowStyles } from './getLogRowStyles';
import { stylesFactory } from '../../themes/stylesFactory';

//Components
import { LogRowContext } from './LogRowContext';
import { LogMessageAnsi } from './LogMessageAnsi';

export const MAX_CHARACTERS = 100000;

interface Props extends Themeable {
  row: LogRowModel;
  hasMoreContextRows?: HasMoreContextRows;
  contextIsOpen: boolean;
  wrapLogMessage: boolean;
  prettifyLogMessage: boolean;
  errors?: LogRowContextQueryErrors;
  context?: LogRowContextRows;
  showContextToggle?: (row?: LogRowModel) => boolean;
  highlighterExpressions?: string[];
  getRows: () => LogRowModel[];
  onToggleContext: () => void;
  updateLimit?: () => void;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const outlineColor = tinycolor(theme.colors.dashboardBg).setAlpha(0.7).toRgbString();

  return {
    positionRelative: css`
      label: positionRelative;
      position: relative;
    `,
    rowWithContext: css`
      label: rowWithContext;
      z-index: 1;
      outline: 9999px solid ${outlineColor};
    `,
    horizontalScroll: css`
      label: verticalScroll;
      white-space: pre;
    `,
  };
});

function renderLogMessage(
  hasAnsi: boolean,
  entry: string,
  highlights: string[] | undefined,
  highlightClassName: string
) {
  const needsHighlighter =
    highlights && highlights.length > 0 && highlights[0] && highlights[0].length > 0 && entry.length < MAX_CHARACTERS;
  if (needsHighlighter) {
    return (
      <Highlighter
        textToHighlight={entry}
        searchWords={highlights ?? []}
        findChunks={findHighlightChunksInText}
        highlightClassName={highlightClassName}
      />
    );
  } else if (hasAnsi) {
    return <LogMessageAnsi value={entry} />;
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

class UnThemedLogRowMessage extends PureComponent<Props> {
  onContextToggle = (e: React.SyntheticEvent<HTMLElement>) => {
    e.stopPropagation();
    this.props.onToggleContext();
  };

  render() {
    const {
      highlighterExpressions,
      row,
      theme,
      errors,
      hasMoreContextRows,
      updateLimit,
      context,
      contextIsOpen,
      showContextToggle,
      wrapLogMessage,
      prettifyLogMessage,
      onToggleContext,
    } = this.props;

    const style = getLogRowStyles(theme, row.logLevel);
    const { hasAnsi, raw } = row;
    const restructuredEntry = restructureLog(raw, prettifyLogMessage);

    const previewHighlights = highlighterExpressions?.length && !isEqual(highlighterExpressions, row.searchWords);
    const highlights = previewHighlights ? highlighterExpressions : row.searchWords;
    const highlightClassName = previewHighlights
      ? cx([style.logsRowMatchHighLight, style.logsRowMatchHighLightPreview])
      : cx([style.logsRowMatchHighLight]);
    const styles = getStyles(theme);

    return (
      <td className={style.logsRowMessage}>
        <div className={cx(styles.positionRelative, { [styles.horizontalScroll]: !wrapLogMessage })}>
          {contextIsOpen && context && (
            <LogRowContext
              row={row}
              context={context}
              errors={errors}
              hasMoreContextRows={hasMoreContextRows}
              onOutsideClick={onToggleContext}
              onLoadMoreContext={() => {
                if (updateLimit) {
                  updateLimit();
                }
              }}
            />
          )}
          <span className={cx(styles.positionRelative, { [styles.rowWithContext]: contextIsOpen })}>
            {renderLogMessage(hasAnsi, restructuredEntry, highlights, highlightClassName)}
          </span>
          {showContextToggle?.(row) && (
            <span onClick={this.onContextToggle} className={cx('log-row-context', style.context)}>
              {contextIsOpen ? 'Hide' : 'Show'} context
            </span>
          )}
        </div>
      </td>
    );
  }
}

export const LogRowMessage = withTheme(UnThemedLogRowMessage);
LogRowMessage.displayName = 'LogRowMessage';
