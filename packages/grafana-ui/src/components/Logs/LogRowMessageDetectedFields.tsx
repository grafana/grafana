import React, { FunctionComponent } from 'react';
import { cx, css } from '@emotion/css';
import { isEqual } from 'lodash';
import memoizeOne from 'memoize-one';
import { LogRowModel, Field, LinkModel, findHighlightChunksInText } from '@grafana/data';
import Highlighter from 'react-highlight-words';
import { getAllFields, FieldDef } from './logParser';
import { MAX_CHARACTERS } from './LogRowMessage';
import { useStyles, useTheme } from '../../themes';
import { getLogRowStyles } from './getLogRowStyles';

type Props = {
  row: LogRowModel;
  showDetectedFields: string[];
  wrapLogMessage: boolean;
  highlighterExpressions?: string[];
  getFieldLinks?: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
};

export const LogRowMessageDetectedFields: FunctionComponent<Props> = React.memo(
  ({ row, getFieldLinks, wrapLogMessage, showDetectedFields, highlighterExpressions }) => {
    const createLine = memoizeOne((fields: FieldDef[]) => {
      return showDetectedFields
        .map((parsedKey) => {
          const field = fields.find((field) => {
            const { key } = field;
            return key === parsedKey;
          });

          if (field) {
            return `${parsedKey}=${field.value}`;
          }

          return null;
        })
        .filter((s) => s !== null)
        .join(' ');
    });

    const styles = useStyles(getStyles);
    const theme = useTheme();
    const style = getLogRowStyles(theme, row.logLevel);

    const fields = getAllFields(row, getFieldLinks);
    const line = createLine(fields);

    const previewHighlights = highlighterExpressions?.length && !isEqual(highlighterExpressions, row.searchWords);
    const highlights = previewHighlights ? highlighterExpressions : row.searchWords;
    const needsHighlighter = Boolean(
      highlights && highlights.length > 0 && highlights[0]?.length > 0 && line.length < MAX_CHARACTERS
    );
    const highlightClassName = previewHighlights
      ? cx([style.logsRowMatchHighLight, style.logsRowMatchHighLightPreview])
      : cx([style.logsRowMatchHighLight]);

    return (
      <>
        {needsHighlighter ? (
          <td>
            <Highlighter
              textToHighlight={line}
              searchWords={highlights ?? []}
              findChunks={findHighlightChunksInText}
              highlightClassName={highlightClassName}
            />
          </td>
        ) : (
          <td className={cx(wrapLogMessage && styles.wrapper)}>{line}</td>
        )}
      </>
    );
  }
);

LogRowMessageDetectedFields.displayName = 'LogRowMessageDetectedFields';

const getStyles = () => ({
  wrapper: css`
    white-space: pre-wrap;
  `,
});
