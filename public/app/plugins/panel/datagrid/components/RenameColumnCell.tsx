import React, { useLayoutEffect, useRef, useState } from 'react';

import { Portal } from '@grafana/ui';

import { RenameColumnInputData } from '../utils';

interface Props {
  renameColumnData: RenameColumnInputData;
  onColumnInputBlur: (columnName: string, columnIdx: number) => void;
}

export const RenameColumnCell = ({ renameColumnData, onColumnInputBlur }: Props) => {
  const { x, y, width, height, inputValue, columnIdx } = renameColumnData;
  const [styles, setStyles] = useState({});
  const [value, setValue] = useState<string>(inputValue!);
  const ref = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    ref.current?.focus();

    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      const collisions = {
        right: window.innerWidth < x! + rect.width,
        bottom: window.innerHeight < y! + rect.height,
      };

      setStyles({
        position: 'fixed',
        left: collisions.right ? x! - rect.width : x!,
        top: collisions.bottom ? y! - rect.height : y!,
        width: width,
        height: height,
      });
    }
  }, [height, width, x, y]);

  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const columnName = e.target.value;
    if (columnName) {
      onColumnInputBlur(columnName, columnIdx!);
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  return (
    <Portal>
      <input type="text" value={value} onBlur={onBlur} ref={ref} style={styles} onChange={onChange} />
    </Portal>
  );
};
