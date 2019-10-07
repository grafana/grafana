import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { getTagColorsFromName } from '../../utils';

interface Props {
  name: string;

  onRemove: (tag: string) => void;
}

export const TagItem: FC<Props> = ({ name, onRemove }) => {
  const { color, borderColor } = getTagColorsFromName(name);

  const itemStyle = css`
    background-color: ${color};
    border: 1px solid ${borderColor};
    border-radius: 3px;
    padding: 3px 6px;
    margin: 3px;
    white-space: nowrap;
    text-shadow: none;
    font-weight: 500;
    line-height: 14px;
    display: flex;
    align-items: center;
  `;

  const nameStyle = css`
    margin-right: 3px;
  `;

  const removeStyle = cx([
    'fa fa-times',
    css`
      cursor: pointer;
    `,
  ]);

  return (
    <div className={itemStyle}>
      <span className={nameStyle}>{name}</span>
      <i className={removeStyle} onClick={() => onRemove(name)} />
    </div>
  );
};
