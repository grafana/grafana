import React, { useCallback } from 'react';
import { Select } from '@grafana/ui';
import { css } from 'emotion';
import { SelectableValue } from '@grafana/data';

interface Props {
  value?: string;
  onChange: (value?: string) => void;
}

function getLabelText(len: number) {
  if (len === 0) {
    return 'empty';
  }
  return `${len} - ` + new Array(len + 1).join('x');
}

const lengths: Array<SelectableValue<number>> = Array(51)
  .fill(0)
  .map((_, i) => {
    return {
      value: i,
      label: getLabelText(i),
    };
  });

export const AlignmentFactorLengthEditor: React.FC<Props> = ({ value, onChange }) => {
  const styles = {
    textInput: css`
      margin-bottom: 8px;
    `,
  };

  const onValueChange = useCallback(
    (v: SelectableValue<number>) => {
      const len = v.value ? v.value : 0;
      const str = new Array(len + 1).join('x');

      onChange(str);
    },
    [onChange]
  );

  const getTextLengthFrom = (txt: string) => {
    if (!txt) {
      return 0;
    }
    const len = parseInt(txt, 10);
    if (isNaN(len)) {
      return txt.length;
    }
    return len;
  };

  const onCreateOption = useCallback(
    (txt: string) => {
      const len = getTextLengthFrom(txt);
      txt = new Array(len + 1).join('a');
      onChange(txt);
    },
    [onChange]
  );

  const len = value ? value.length : 0;

  return (
    <Select
      className={styles.textInput}
      options={lengths}
      value={lengths.find(v => v.value === len) ?? { value: len, label: getLabelText(len) }}
      onChange={onValueChange}
      onCreateOption={onCreateOption}
      allowCustomValue={true}
      formatCreateLabel={txt => `Use text length: ${getTextLengthFrom(txt)}`}
      backspaceRemovesValue={true}
    />
  );
};
