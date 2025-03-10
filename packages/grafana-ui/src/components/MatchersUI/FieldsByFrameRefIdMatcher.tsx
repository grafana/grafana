import { useMemo, useState, useCallback } from 'react';

import { DataFrame, getFrameDisplayName, FieldMatcherID, fieldMatchers } from '@grafana/data';

import { Combobox } from '../Combobox/Combobox';
import { MultiCombobox } from '../Combobox/MultiCombobox';
import { ComboboxOption } from '../Combobox/types';

import { FieldMatcherUIRegistryItem, MatcherUIProps } from './types';

const recoverRefIdMissing = (
  newRefIds: ComboboxOption[],
  oldRefIds: ComboboxOption[],
  previousValue: string | undefined
): ComboboxOption | undefined => {
  if (!previousValue) {
    return;
  }
  // Previously selected value is missing from the new list.
  // Find the value that is in the new list but isn't in the old list
  let changedTo = newRefIds.find((refId) => {
    return !oldRefIds.some((refId2) => {
      return refId === refId2;
    });
  });
  if (changedTo) {
    // Found the new value, we assume the old value changed to this one, so we'll use it
    return changedTo;
  }
  return;
};

export interface Props {
  value?: string; // refID
  data: DataFrame[];
  onChange: (value: string) => void;
  placeholder?: string;
}

// Not exported globally... but used in grafana core
export function RefIDPicker({ value, data, onChange, placeholder }: Props) {
  const listOfRefIds = useMemo(() => getListOfQueryRefIds(data), [data]);

  const [priorSelectionState, updatePriorSelectionState] = useState<{
    refIds: ComboboxOption[];
    value: string | undefined;
  }>({
    refIds: [],
    value: undefined,
  });

  const currentValue = useMemo(() => {
    return (
      listOfRefIds.find((refId) => refId.value === value) ??
      recoverRefIdMissing(listOfRefIds, priorSelectionState.refIds, priorSelectionState.value)
    );
  }, [value, listOfRefIds, priorSelectionState]);

  const onFilterChange = useCallback(
    (v: ComboboxOption<string> | null) => {
      v ? onChange(v.value!) : onChange('');
    },
    [onChange]
  );

  if (listOfRefIds !== priorSelectionState.refIds || currentValue?.value !== priorSelectionState.value) {
    updatePriorSelectionState({
      refIds: listOfRefIds,
      value: currentValue?.value,
    });
  }
  return (
    <Combobox
      options={listOfRefIds}
      onChange={onFilterChange}
      isClearable={true}
      placeholder={placeholder ?? 'Select query refId'}
      value={currentValue}
    />
  );
}

const recoverMultiRefIdMissing = (
  newRefIds: Array<ComboboxOption<string>>,
  oldRefIds: Array<ComboboxOption<string>>,
  previousValue: Array<ComboboxOption<string>> | undefined
): Array<ComboboxOption<string>> | undefined => {
  if (!previousValue || !previousValue.length) {
    return;
  }
  // Previously selected value is missing from the new list.
  // Find the value that is in the new list but isn't in the old list
  const changedTo = newRefIds.filter((newRefId) => {
    return oldRefIds.some((oldRefId) => {
      return newRefId === oldRefId;
    });
  });

  if (changedTo.length) {
    // Found the new value, we assume the old value changed to this one, so we'll use it
    return changedTo;
  }
  return;
};

export interface MultiProps {
  value?: string; // 1 or more refID in reqExp format /A|B|C/
  data: DataFrame[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function RefIDMultiPicker({ value, data, onChange, placeholder }: MultiProps) {
  const listOfRefIds = useMemo(() => getListOfQueryRefIds(data), [data]);

  const [priorSelectionState, updatePriorSelectionState] = useState<{
    refIds: ComboboxOption[];
    value: Array<ComboboxOption<string>> | undefined;
  }>({
    refIds: [],
    value: undefined,
  });

  const currentValue = useMemo(() => {
    let extractedRefIds = new Set<string>();

    if (value) {
      if (value.startsWith('/^')) {
        try {
          extractedRefIds = new Set(regexpToStrings(value));
        } catch {
          extractedRefIds.add(value);
        }
      } else if (value.includes('|')) {
        // old format that was simply unescaped pipe-joined strings -> regexp
        extractedRefIds = new Set(value.split('|'));
      } else {
        extractedRefIds.add(value);
      }
    }

    const matchedRefIds = listOfRefIds.filter((refId) => extractedRefIds.has(refId.value || ''));

    if (matchedRefIds.length) {
      return matchedRefIds;
    }
    const toOption = (value: string): ComboboxOption<string> => ({ label: value, value });

    const newRefIds = [...extractedRefIds].map(toOption);

    return recoverMultiRefIdMissing(newRefIds, priorSelectionState.refIds, priorSelectionState.value);
  }, [value, listOfRefIds, priorSelectionState]);

  const onFilterChange = useCallback(
    (v: Array<ComboboxOption<string>>) => {
      onChange(v.map((v) => v.value!));
    },
    [onChange]
  );

  if (listOfRefIds !== priorSelectionState.refIds || currentValue?.length !== priorSelectionState.value?.length) {
    updatePriorSelectionState({
      refIds: listOfRefIds,
      value: currentValue,
    });
  }
  return (
    <MultiCombobox
      options={listOfRefIds}
      onChange={onFilterChange}
      isClearable={true}
      placeholder={placeholder ?? 'Select query refId'}
      value={currentValue}
    />
  );
}

function getListOfQueryRefIds(data: DataFrame[]): Array<ComboboxOption<string>> {
  const queries = new Map<string, DataFrame[]>();

  for (const frame of data) {
    const refId = frame.refId ?? '';
    const frames = queries.get(refId) ?? [];

    if (frames.length === 0) {
      queries.set(refId, frames);
    }

    frames.push(frame);
  }

  const values: Array<ComboboxOption<string>> = [];

  for (const [refId, frames] of queries.entries()) {
    values.push({
      value: refId,
      label: `Query: ${refId ?? '(missing refId)'}`,
      description: getFramesDescription(frames),
    });
  }

  return values;
}

function getFramesDescription(frames: DataFrame[]): string {
  return `Frames (${frames.length}):
    ${frames
      .slice(0, Math.min(3, frames.length))
      .map((x) => getFrameDisplayName(x))
      .join(', ')} ${frames.length > 3 ? '...' : ''}`;
}

/**
 * Registry item for UI to configure "fields by frame refId"-matcher.
 * @public
 */
export const fieldsByFrameRefIdItem: FieldMatcherUIRegistryItem<string> = {
  id: FieldMatcherID.byFrameRefID,
  component: (props: MatcherUIProps<string>) => {
    return <RefIDPicker value={props.options} data={props.data} onChange={props.onChange} />;
  },
  matcher: fieldMatchers.get(FieldMatcherID.byFrameRefID),
  name: 'Fields returned by query',
  description: 'Set properties for fields from a specific query',
  optionsToLabel: (options) => options,
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#escaping
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

// funcs below will parse/unparse a regexp like /^(?:foo|bar)$/ -> ["foo", "bar"]

/** @internal */
export const regexpToStrings = (regexp: string) => {
  return (
    regexp
      // strip /^(?:)$/ wrapper
      .slice(5, -3)
      // split on unescaped |
      .split(/(?<!\\)\|/g)
      // unescape remaining escaped chars
      .map((string) => string.replace(/\\(.)/g, '$1'))
  );
};

/** @internal */
export const stringsToRegexp = (strings: string[]) => {
  return `/^(?:${strings.map((string) => escapeRegExp(string)).join('|')})$/`;
};
