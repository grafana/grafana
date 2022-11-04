import React from 'react';

import { LoadingState, VariableHide } from '@grafana/data';
import { ClickOutsideWrapper } from '@grafana/ui';
import { VariableInput } from 'app/features/variables/pickers/shared/VariableInput';
import { VariableLink } from 'app/features/variables/pickers/shared/VariableLink';
import VariableOptions from 'app/features/variables/pickers/shared/VariableOptions';

import { SceneComponentProps } from '../../core/types';
import { MultiValueVariable } from '../variants/MultiValueVariable';

export function VariableValueSelect({ model }: SceneComponentProps<MultiValueVariable>) {
  const { value, text, key, hide, isSelectOpen, state, isMulti, highlightIndex } = model.useState();

  if (hide === VariableHide.hideVariable) {
    return null;
  }

  return (
    <>
      {!isSelectOpen && (
        <VariableLink
          id={key!}
          text={text as string}
          loading={state === LoadingState.Loading}
          onCancel={() => {}}
          onClick={model.onOpenSelect}
        />
      )}
      {isSelectOpen && (
        <ClickOutsideWrapper onClick={model.onCloseSelect}>
          <VariableInput
            id={key}
            value={value as string}
            onChange={model.onFilterOrSearchOptions}
            onNavigate={model.onNavigate}
            aria-expanded={isSelectOpen}
            aria-controls={`options-${key}`}
          />
          <VariableOptions
            values={model.getOldPickerOptions()}
            onToggle={model.onToggleOption}
            onToggleAll={model.onToggleAllOptions}
            highlightIndex={highlightIndex ?? 0}
            multi={isMulti === true}
            selectedValues={[]}
            id={`options-${key}`}
          />
        </ClickOutsideWrapper>
      )}
    </>
  );
}
