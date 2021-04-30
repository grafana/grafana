import React, { useState, useRef, useEffect } from 'react';
import { css } from '@emotion/css';
import { SelectableValue } from '@grafana/data';
import { useClickAway, useAsyncFn } from 'react-use';
import { InlineLabel, Select } from '@grafana/ui';
import { unwrap } from './unwrap';

type SharedProps = {
  loadOptions: () => Promise<SelectableValue[]>;
  allowCustomValue?: boolean;
};

type Props = SharedProps & {
  onAdd: (v: string) => void;
};

const selectClass = css({
  width: '160px',
});

type SelProps = SharedProps & {
  onChange: (v: SelectableValue) => void;
  onClose: () => void;
};

export const Sel = ({ loadOptions, allowCustomValue, onChange, onClose }: SelProps): JSX.Element => {
  const ref = useRef(null);
  const [loadState, doLoad] = useAsyncFn(loadOptions, [loadOptions]);
  useClickAway(ref, onClose);

  useEffect(() => {
    doLoad();
  }, [loadOptions]);
  return (
    <div ref={ref} className={selectClass}>
      <Select autoFocus isOpen allowCustomValue options={loadState.value ?? []} onChange={onChange} />
    </div>
  );
};

const buttonClass = css({
  width: 'auto',
  cursor: 'pointer',
});

export const AddButton = ({ loadOptions, allowCustomValue, onAdd }: Props): JSX.Element => {
  const [isOpen, setOpen] = useState(false);
  if (!isOpen) {
    // this should not be a label, this should be a button,
    // but this is what is used inside a Segment, and i just
    // want the same look
    return (
      <InlineLabel
        className={buttonClass}
        onClick={() => {
          setOpen(true);
        }}
      >
        +
      </InlineLabel>
    );
  } else {
    return (
      <Sel
        loadOptions={loadOptions}
        allowCustomValue={allowCustomValue}
        onChange={(v) => {
          setOpen(false);
          onAdd(unwrap(v.value));
        }}
        onClose={() => {
          setOpen(false);
        }}
      />
    );
  }
};
