import React, { FC } from 'react';
import { TableHeaderProps } from './types';
import { css } from 'emotion';
import { Icon } from '..';

export const DefaultHeader: FC<TableHeaderProps> = ({ field, tableStyles, textAlign, isSorted, isSortedDesc }) => {
  const style = css`
    ${tableStyles.headerCell};
    text-align: ${textAlign};
  `;

  return (
    <div className={style}>
      {field.name}
      {isSorted && (isSortedDesc ? <Icon name="caret-down" /> : <Icon name="caret-up" />)}
    </div>
  );
};

export const RightAlignedHeader: FC<TableHeaderProps> = props => {
  return <DefaultHeader {...props} textAlign={'right'} />;
};

export const CenterAlignedHeader: FC<TableHeaderProps> = props => {
  return <DefaultHeader {...props} textAlign={'center'} />;
};
