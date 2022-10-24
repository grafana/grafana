import React, { ReactNode } from 'react';

interface TableCellSubOptionsEditorProps {
  editor: ReactNode; // Each cell type will provide it's own editor
}

export const TableCellSubOptionsEditor: React.FC<TableCellSubOptionsEditorProps> = ({ editor }) => {
  // Do processing with the values here

  // Setup and inject editor
  return <>{editor}</>;
};
