import React, { FC, useCallback } from 'react';
import { useLocalStorage } from 'react-use';
import { PANEL_EDITOR_UI_STATE_STORAGE_KEY } from './state/reducers';
import { OptionsGroup } from './OptionsGroup';
import { OptionsGroupProps } from './types';

interface Props extends OptionsGroupProps {
  id: string;
}

export const OptionsGroupWithPersistence: FC<Props> = props => {
  const [value, setValue] = useLocalStorage(getOptionGroupStorageKey(props.id), {
    defaultToClosed: props.defaultToClosed,
  });
  const onToggle = useCallback(
    (isExpanded: boolean) => {
      setValue({ defaultToClosed: !isExpanded });
      if (props.onToggle) {
        props.onToggle(isExpanded);
      }
    },
    [setValue, props.onToggle]
  );

  return <OptionsGroup {...props} defaultToClosed={value.defaultToClosed} onToggle={onToggle} />;
};

OptionsGroupWithPersistence.displayName = 'OptionsGroupWithPersistence';

const getOptionGroupStorageKey = (id: string): string => `${PANEL_EDITOR_UI_STATE_STORAGE_KEY}.optionGroup[${id}]`;
