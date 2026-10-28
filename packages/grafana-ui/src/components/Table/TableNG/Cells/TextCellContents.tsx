import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type Field } from '@grafana/data';

import { MaybeWrapWithLink } from '../components/MaybeWrapWithLink';

export const textCellClassName = css({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export function TextCellContents({
  field,
  rowIdx,
  children,
  tableRefreshEnabled,
}: {
  field: Field;
  rowIdx: number;
  children: ReactNode;
  tableRefreshEnabled?: boolean;
}) {
  const contents = (
    <MaybeWrapWithLink field={field} rowIdx={rowIdx}>
      {children}
    </MaybeWrapWithLink>
  );
  // A flex cell's anonymous text item cannot show ellipsis. Keep links inside the clipping box.
  return tableRefreshEnabled ? <div className={textCellClassName}>{contents}</div> : contents;
}
