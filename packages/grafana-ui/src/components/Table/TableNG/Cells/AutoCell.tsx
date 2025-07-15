import { css } from '@emotion/css';
import { CSSProperties } from 'react';

import { GrafanaTheme2, formattedValueToString } from '@grafana/data';

import { renderSingleLink } from '../../DataLinksActionsTooltip';
import { TableCellDisplayMode } from '../../types';
import { useSingleLink } from '../hooks';
import { AutoCellProps } from '../types';

export default function AutoCell({ value, field, rowIdx, singleLinkClass }: AutoCellProps) {
  const displayValue = field.display!(value);
  const formattedValue = formattedValueToString(displayValue);
  const link = useSingleLink(field, rowIdx);

  return link == null ? formattedValue : renderSingleLink(link, formattedValue, singleLinkClass);
}

export function getSingleLinkClass(theme: GrafanaTheme2, cellType: TableCellDisplayMode) {
  const common: CSSProperties = {
    cursor: 'pointer',
  };

  if (cellType === TableCellDisplayMode.Auto) {
    return css({
      ...common,
      color: theme.colors.text.link,

      '&:hover': {
        textDecoration: 'underline',
      },
    });
  }

  // colored cells
  return css({
    ...common,
    color: 'inherit',
    textDecoration: 'underline',
  });
}
