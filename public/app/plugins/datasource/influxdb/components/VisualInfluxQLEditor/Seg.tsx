import React, { useState, useEffect } from 'react';
import debouncePromise from 'debounce-promise';
import { cx, css } from '@emotion/css';
import { SelectableValue } from '@grafana/data';
import { useAsyncFn } from 'react-use';
import { InlineLabel, Select, AsyncSelect, Input } from '@grafana/ui';
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

type LoadOptions = (filter: string) => Promise<SelVal[]>;

type Props = {
  value?: string;
  placeholder?: string;
  buttonClassName?: string;
  loadOptions?: LoadOptions;
  // if filterByLoadOptions is false,
  // loadOptions is only executed once,
  // when the select-box opens,
  // and as you write, the list gets filtered
  // by the select-box.
  // if filterByLoadOptions is true,
  // as you write the loadOptions is executed again and again,
  // and it is relied on to filter the results.
  filterByLoadOptions?: boolean;
  onChange: (v: SelVal | null) => void;
  allowCustomValue?: boolean;
  isClearable?: boolean;
};

const selectClass = css({
  minWidth: '160px',
});

type SelProps = {
  value: string;
  loadOptions: LoadOptions;
  filterByLoadOptions?: boolean;
  onClose: () => void;
  onChange: (v: SelVal | null) => void;
  allowCustomValue?: boolean;
  isClearable: boolean;
};

type SelReloadProps = {
  loadOptions: (filter: string) => Promise<SelVal[]>;
  onClose: () => void;
  onChange: (v: SelVal | null) => void;
  allowCustomValue?: boolean;
};

// when a custom value is written into a select-box,
// by default the new value is prefixed with "Create:",
// and that sounds confusing because here we do not create
// anything. we change this to just be the entered string.
const formatCreateLabel = (v: string) => v;

const SelReload = ({ loadOptions, allowCustomValue, onChange, onClose }: SelReloadProps): JSX.Element => {
  // here we rely on the fact that writing text into the <AsyncSelect/>
  // does not cause a re-render of the current react component.
  // this way there is only a single render-call,
  // so there is only a single `debouncedLoadOptions`.
  // if we want ot make this "re-render safe,
  // we will have to put the debounced call into an useRef,
  // and probably have an useEffect
  const debouncedLoadOptions = debouncePromise(loadOptions, 1000, { leading: true });

  // this component does not have a `value`. the way it works,
  // when it opens up you always start "empty"
  return (
    <div className={selectClass}>
      <AsyncSelect
        formatCreateLabel={formatCreateLabel}
        defaultOptions
        autoFocus
        isOpen
        onCloseMenu={onClose}
        allowCustomValue={allowCustomValue}
        loadOptions={debouncedLoadOptions}
        onChange={onChange}
      />
    </div>
  );
};

type SelSingleLoadProps = {
  value: string;
  loadOptions: (filter: string) => Promise<SelVal[]>;
  onClose: () => void;
  onChange: (v: SelVal | null) => void;
  allowCustomValue?: boolean;
  isClearable: boolean;
};

const SelSingleLoad = ({
  value,
  loadOptions,
  allowCustomValue,
  isClearable,
  onChange,
  onClose,
}: SelSingleLoadProps): JSX.Element => {
  const [loadState, doLoad] = useAsyncFn(loadOptions, [loadOptions]);

  useEffect(() => {
    doLoad();
  }, [doLoad, loadOptions]);

  const options = loadState.value ?? [];

  // if the current-value is not in the list-of-options, and it is not empty, we have to add
  // it to the options
  const valueInOptions = options.some((x) => x.value === value);

  const fullOptions = value === '' || valueInOptions ? options : [{ label: value, value }, ...options];

  return (
    <div className={selectClass}>
      <Select
        formatCreateLabel={formatCreateLabel}
        isOpen
        value={value}
        isClearable={isClearable}
        autoFocus
        onCloseMenu={onClose}
        allowCustomValue={allowCustomValue}
        options={fullOptions}
        onChange={onChange}
      />
    </div>
  );
};

const Sel = ({
  value,
  isClearable,
  loadOptions,
  filterByLoadOptions,
  allowCustomValue,
  onChange,
  onClose,
}: SelProps): JSX.Element => {
  // unfortunately <Segment/> and <SegmentAsync/> have somewhat different behavior,
  // so the simplest approach was to just create two separate wrapper-components
  return filterByLoadOptions ? (
    <SelReload loadOptions={loadOptions} allowCustomValue={allowCustomValue} onChange={onChange} onClose={onClose} />
  ) : (
    <SelSingleLoad
      isClearable={isClearable}
      value={value}
      loadOptions={loadOptions}
      allowCustomValue={allowCustomValue}
      onChange={onChange}
      onClose={onClose}
    />
  );
};

type InpProps = {
  initialValue: string;
  onChange: (newVal: string) => void;
};

const Inp = ({ initialValue, onChange }: InpProps): JSX.Element => {
  const [currentValue, setCurrentValue] = useShadowedState(initialValue);

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

export const Seg = ({
  placeholder,
  value,
  buttonClassName,
  loadOptions,
  filterByLoadOptions,
  allowCustomValue,
  isClearable,
  onChange,
}: Props): JSX.Element => {
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
        {value ?? placeholder ?? ''}
      </InlineLabel>
    );
  } else {
    if (loadOptions !== undefined) {
      return (
        <Sel
          isClearable={isClearable ?? false}
          value={value ?? ''}
          loadOptions={loadOptions}
          filterByLoadOptions={filterByLoadOptions ?? false}
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
          initialValue={value ?? ''}
          onChange={(v) => {
            setOpen(false);
            onChange({ value: v, label: v });
          }}
        />
      );
    }
  }
};
