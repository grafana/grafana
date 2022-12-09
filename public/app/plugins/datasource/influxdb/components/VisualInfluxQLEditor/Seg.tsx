import { cx, css } from '@emotion/css';
import debouncePromise from 'debounce-promise';
import React, { useState, useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { SelectableValue } from '@grafana/data';
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
  value: string;
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
  onChange: (v: SelVal) => void;
  allowCustomValue?: boolean;
};

const selectClass = css({
  minWidth: '160px',
});

type SelProps = {
  loadOptions: LoadOptions;
  filterByLoadOptions?: boolean;
  onClose: () => void;
  onChange: (v: SelVal) => void;
  allowCustomValue?: boolean;
};

type SelReloadProps = {
  loadOptions: (filter: string) => Promise<SelVal[]>;
  onClose: () => void;
  onChange: (v: SelVal) => void;
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
  loadOptions: (filter: string) => Promise<SelVal[]>;
  onClose: () => void;
  onChange: (v: SelVal) => void;
  allowCustomValue?: boolean;
};

const SelSingleLoad = ({ loadOptions, allowCustomValue, onChange, onClose }: SelSingleLoadProps): JSX.Element => {
  const [loadState, doLoad] = useAsyncFn(loadOptions, [loadOptions]);

  useEffect(() => {
    doLoad('');
  }, [doLoad, loadOptions]);

  return (
    <div className={selectClass}>
      <Select
        isLoading={loadState.loading}
        formatCreateLabel={formatCreateLabel}
        autoFocus
        isOpen={!loadState.loading}
        onCloseMenu={onClose}
        allowCustomValue={allowCustomValue}
        options={loadState.value ?? []}
        onChange={onChange}
      />
    </div>
  );
};

const Sel = ({ loadOptions, filterByLoadOptions, allowCustomValue, onChange, onClose }: SelProps): JSX.Element => {
  // unfortunately <Segment/> and <SegmentAsync/> have somewhat different behavior,
  // so the simplest approach was to just create two separate wrapper-components
  return filterByLoadOptions ? (
    <SelReload loadOptions={loadOptions} allowCustomValue={allowCustomValue} onChange={onChange} onClose={onClose} />
  ) : (
    <SelSingleLoad
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
  onClose: () => void;
};

const Inp = ({ initialValue, onChange, onClose }: InpProps): JSX.Element => {
  const [currentValue, setCurrentValue] = useShadowedState(initialValue);

  return (
    <Input
      autoFocus
      type="text"
      spellCheck={false}
      onBlur={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onChange(currentValue);
        }
      }}
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
  value,
  buttonClassName,
  loadOptions,
  filterByLoadOptions,
  allowCustomValue,
  onChange,
}: Props): JSX.Element => {
  const [isOpen, setOpen] = useState(false);
  if (!isOpen) {
    const className = cx(defaultButtonClass, buttonClassName);
    return (
      <InlineLabel
        as="button"
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
          initialValue={value}
          onClose={() => {
            setOpen(false);
          }}
          onChange={(v) => {
            setOpen(false);
            onChange({ value: v, label: v });
          }}
        />
      );
    }
  }
};
