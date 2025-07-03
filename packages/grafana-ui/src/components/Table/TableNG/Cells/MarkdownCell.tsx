import { css } from '@emotion/css';
import { Property } from 'csstype';
import { useState } from 'react';

import { GrafanaTheme2, renderMarkdown, formattedValueToString } from '@grafana/data';
import { FieldTextAlignment } from '@grafana/schema';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { DataLinksActionsTooltip } from '../../DataLinksActionsTooltip';
import { DataLinksActionsTooltipCoords, tooltipOnClickHandler } from '../../utils';
import { TABLE } from '../constants';
import { MarkdownCellProps } from '../types';
import { getCellLinks } from '../utils';

export function MarkdownCell({ height, value, field, justifyContent, rowIdx, actions }: MarkdownCellProps) {
  const align: FieldTextAlignment | undefined = field.config?.custom?.align;
  const styles = useStyles2(getStyles, justifyContent, align);
  // In the future, we could support an auto-height experience by measuring the height of the rendered markdown
  // and sending it back up to the TableNG so that it can manage the row height.
  // const [markdownDivRef, { height }] = useMeasure<HTMLDivElement>();

  // useEffect(() => {
  //   onUpdateHeight(height);
  // }, [onUpdateHeight, height]);

  const markdownContent =
    typeof value === 'string' ? renderMarkdown(value) : formattedValueToString(field.display!(value));
  const markdownDiv = (
    <div className={styles.markdownOverrides} dangerouslySetInnerHTML={{ __html: markdownContent.trim() }} />
  );
  const links = getCellLinks(field, rowIdx) || [];

  const [tooltipCoords, setTooltipCoords] = useState<DataLinksActionsTooltipCoords>();
  const shouldShowTooltip = (!!links.length || !!actions?.length) && tooltipCoords !== undefined;

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
    <div
      className={styles.cell}
      style={{ height: height - TABLE.CELL_PADDING * 2 }}
      onClick={tooltipOnClickHandler(setTooltipCoords)}
    >
      {shouldShowTooltip ? (
        <DataLinksActionsTooltip
          links={links}
          actions={actions}
          value={markdownDiv}
          coords={tooltipCoords}
          onTooltipClose={() => setTooltipCoords(undefined)}
        />
      ) : (
        markdownDiv
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, justifyContent?: Property.JustifyContent, align?: FieldTextAlignment) => ({
  cell: css({
    display: 'flex',
    justifyContent,
    alignItems: 'center',
    cursor: 'context-menu',
    textAlign: align !== 'auto' ? align : undefined,
  }),
  markdownOverrides: css({
    '& ol, & ul': {
      paddingLeft: '1.5em',
    },
    '& p': {
      whiteSpace: 'pre-line',
    },
    '& a': {
      color: theme.colors.primary.text,
    },
    '& > *:last-child': {
      marginBottom: 0,
    },
  }),
});
