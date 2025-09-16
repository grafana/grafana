import { useState } from 'react';
import * as React from 'react';

import { t } from '@grafana/i18n';

import { SimpleInput } from './SimpleInput';

interface AddColumnProps {
  divStyle: string;
  onColumnInputBlur: (columnName: string) => void;
}

export const AddColumn = ({ divStyle, onColumnInputBlur }: AddColumnProps) => {
  const [showInput, setShowInput] = useState<boolean>(false);

  const setupColumnInput = () => {
    setShowInput(true);
  };

  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const columnName = e.target.value;
    if (columnName) {
      onColumnInputBlur(columnName);
    }

    setShowInput(false);
  };

  return (
    <div className={divStyle}>
      {showInput ? (
        <SimpleInput placeholder={t('datagrid.add-column.placeholder-column-name', 'Column name')} onBlur={onBlur} />
      ) : (
        <button onClick={setupColumnInput}>+</button>
      )}
    </div>
  );
};
