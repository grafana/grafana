import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { getTagColorsFromName } from '../../utils';
import { stylesFactory } from '../../themes';

interface Props {
  name: string;

  onRemove: (tag: string) => void;
}

export const TagItem: FC<Props> = ({ name, onRemove }) => {
  const { color, borderColor } = getTagColorsFromName(name);

  const getStyles = stylesFactory(() => ({
    itemStyle: css`
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
    `,

    nameStyle: css`
      margin-right: 3px;
    `,

    removeStyle: cx([
      'fa fa-times',
      css`
        cursor: pointer;
      `,
    ]),
  }));

  return (
    <div className={getStyles().itemStyle}>
      <span className={getStyles().nameStyle}>{name}</span>
      <i className={getStyles().removeStyle} onClick={() => onRemove(name)} />
    </div>
  );
};
