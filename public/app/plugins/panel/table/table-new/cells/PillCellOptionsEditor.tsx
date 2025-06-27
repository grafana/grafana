import React from 'react';

import { TablePillCellOptions } from '@grafana/schema';


import { TableCellEditorProps } from '../TableCellOptionEditor';

export interface TablePillCellOptionsWithPalette extends TablePillCellOptions {}

interface PillCellOptionsEditorProps extends TableCellEditorProps<TablePillCellOptions> {
  fieldConfig?: any;
}

export const PillCellOptionsEditor: React.FC<PillCellOptionsEditorProps> = ({ fieldConfig }) => {
  //TODO be able to add in a color picker
  return (
    <></>
  );
}; 
