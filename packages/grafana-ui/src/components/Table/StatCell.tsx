import React from 'react';

import { BigValue } from '..';

import { TableCellProps } from './types';



export const StatCell = (props: TableCellProps) => {
    const { cell } = props;

    return <BigValue value={cell.value} />;
};
