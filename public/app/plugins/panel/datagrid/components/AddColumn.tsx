import React, { useState } from 'react';

import { SimpleInput } from './SimpleInput';

interface Props {
  divStyle: string;
  onColumnInputBlur: (columnName: string) => void;
}

export const AddColumn = ({ divStyle, onColumnInputBlur }: Props) => {
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
        <SimpleInput placeholder="Column Name" onBlur={onBlur} />
      ) : (
        <button onClick={setupColumnInput}>+</button>
      )}
    </div>
  );
};
