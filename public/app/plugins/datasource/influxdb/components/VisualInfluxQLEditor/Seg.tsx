import React, { useState, useRef, useEffect } from 'react';
import { cx, css } from '@emotion/css';
import { SelectableValue } from '@grafana/data';
import { useClickAway, useAsyncFn } from 'react-use';
import { InlineLabel, Select, Input } from '@grafana/ui';
import { useShadowedState } from '../useShadowedState';

// this file is a simpler version of `grafana-ui / SegmentAsync.tsx`
// with some changes:
// 1. click-outside does not select the value. i think it's better to be explicit here.
// 2. we set a min-width on the select-element to handle cases where the `value`
//    is very short, like "x", and then you click on it and the select opens,
//    and it tries to be as short as "x" and it does not work well.

// NOTE: maybe these changes could be migrated into the SegmentAsync later

type SelVal = SelectableValue<string>;

// when allowCustomValue is true, there is no way to enforce the selectableValue
// enum-type, so i just go with `string`

type Props = {
  value: string;
  buttonClassName?: string;
  loadOptions?: () => Promise<SelVal[]>;
  onChange: (v: SelVal) => void;
  allowCustomValue?: boolean;
};

const selectClass = css({
  minWidth: '160px',
});

type SelProps = {
  loadOptions: () => Promise<SelVal[]>;
  onClose: () => void;
  onChange: (v: SelVal) => void;
  allowCustomValue?: boolean;
};

const Sel = ({ loadOptions, allowCustomValue, onChange, onClose }: SelProps): JSX.Element => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [loadState, doLoad] = useAsyncFn(loadOptions, [loadOptions]);
  useClickAway(ref, onClose);

  useEffect(() => {
    doLoad();
  }, [doLoad, loadOptions]);
  return (
    <div ref={ref} className={selectClass}>
      <Select
        autoFocus
        isOpen
        allowCustomValue={allowCustomValue}
        options={loadState.value ?? []}
        onChange={onChange}
      />
    </div>
  );
};

type InpProps = {
  initialValue: string;
  onChange: (newVal: string) => void;
};

const Inp = ({ initialValue, onChange }: InpProps): JSX.Element => {
  const [currentValue, setCurrentValue] = useShadowedState(initialValue);

  console.log(initialValue, currentValue);
  const onBlur = () => {
    // we send empty-string as undefined
    onChange(currentValue);
  };

  return (
    <Input
      autoFocus
      type="text"
      spellCheck={false}
      onBlur={onBlur}
      onChange={(e) => {
        setCurrentValue(e.currentTarget.value);
      }}
      value={currentValue}
    />
  );
};

const defaultButtonClass = css({
  width: 'auto',
  cursor: 'pointer',
});

export const Seg = ({ value, buttonClassName, loadOptions, allowCustomValue, onChange }: Props): JSX.Element => {
  const [isOpen, setOpen] = useState(false);
  if (!isOpen) {
    const className = cx(defaultButtonClass, buttonClassName);
    // this should not be a label, this should be a button,
    // but this is what is used inside a Segment, and i just
    // want the same look
    return (
      <InlineLabel
        className={className}
        onClick={() => {
          setOpen(true);
        }}
      >
        {value}
      </InlineLabel>
    );
  } else {
    if (loadOptions !== undefined) {
      return (
        <Sel
          loadOptions={loadOptions}
          allowCustomValue={allowCustomValue}
          onChange={(v) => {
            setOpen(false);
            onChange(v);
          }}
          onClose={() => {
            setOpen(false);
          }}
        />
      );
    } else {
      return (
        <Inp
          initialValue={value}
          onChange={(v) => {
            setOpen(false);
            onChange({ value: v, label: v });
          }}
        />
      );
    }
  }
};
