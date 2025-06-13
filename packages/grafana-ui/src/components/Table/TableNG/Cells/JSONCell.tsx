import { css } from '@emotion/css';
import { Property } from 'csstype';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { DataLinksActionsTooltip, renderSingleLink } from '../../DataLinksActionsTooltip';
import { DataLinksActionsTooltipCoords, getDataLinksActionsTooltipUtils } from '../../utils';
import { JSONCellProps } from '../types';
import { getCellLinks } from '../utils';

export const JSONCell = ({ value, justifyContent, field, rowIdx, actions }: JSONCellProps) => {
  const styles = useStyles2(getStyles, justifyContent);

  let displayValue = value;

  // Handle string values that might be JSON
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      displayValue = JSON.stringify(parsed, null, ' ');
    } catch {
      displayValue = value; // Keep original if not valid JSON
    }
  } else {
    // For non-string values, stringify them
    try {
      displayValue = JSON.stringify(value, null, ' ');
    } catch (error) {
      // Handle circular references or other stringify errors
      displayValue = String(value);
    }
  }

  const links = getCellLinks(field, rowIdx) || [];

  const [tooltipCoords, setTooltipCoords] = useState<DataLinksActionsTooltipCoords>();
  const { shouldShowLink, hasMultipleLinksOrActions } = getDataLinksActionsTooltipUtils(links, actions);
  const shouldShowTooltip = hasMultipleLinksOrActions && tooltipCoords !== undefined;

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
    <div
      className={styles.jsonText}
      onClick={({ clientX, clientY }) => setTooltipCoords({ clientX, clientY })}
      style={{ cursor: hasMultipleLinksOrActions ? 'context-menu' : 'auto' }}
    >
      {shouldShowLink ? (
        renderSingleLink(links[0], displayValue)
      ) : shouldShowTooltip ? (
        <DataLinksActionsTooltip
          links={links}
          actions={actions}
          value={displayValue}
          coords={tooltipCoords}
          onTooltipClose={() => setTooltipCoords(undefined)}
        />
      ) : (
        displayValue
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, justifyContent: Property.JustifyContent) => ({
  jsonText: css({
    display: 'flex',
    cursor: 'pointer',
    fontFamily: 'monospace',
    justifyContent: justifyContent,
  }),
});
