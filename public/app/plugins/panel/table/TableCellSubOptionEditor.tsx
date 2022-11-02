import React, { ReactNode } from 'react';

import { FieldOverrideEditorProps } from '@grafana/data';

import { BarGaugeCellOptions } from './cells/BarGaugeCellOptions';


// interface TableCellSubOptionEditorProps {
//   editor: ReactNode; // Each cell type will provide it's own editor
// }

export const TableCellSubOptionEditor: React.FC<FieldOverrideEditorProps<string, any>> = (props: object) => {
  // Do processing with the values here
  let editor: ReactNode | null = null;

  console.log(props);

  if (true) {
    editor = <BarGaugeCellOptions {...props} />
  }

  // Setup and inject editor
  
  return <>{ editor }</>;
};

export const cellHasSubOptions = (displayMode: string): boolean => {
  return displayMode === 'gauge';
}
