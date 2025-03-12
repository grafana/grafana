import { Control, Controller } from 'react-hook-form';

import { BootstrapOptionCard } from './BootstrapOptionCard';
import { ModeOption, OptionState, WizardFormData } from './types';

interface Props {
  control: Control<WizardFormData>;
  selectedOption: ModeOption | null;
  getOptionState: (option: ModeOption) => OptionState;
  onOptionSelect: (option: ModeOption) => void;
  sortedModeOptions: ModeOption[];
}

export function BootstrapOptionsList({
  control,
  selectedOption,
  getOptionState,
  onOptionSelect,
  sortedModeOptions,
}: Props) {
  return (
    <Controller
      name="repository.sync.target"
      control={control}
      defaultValue={undefined}
      render={({ field }) => (
        <>
          {sortedModeOptions.map((option, index) => {
            const optionState = getOptionState(option);
            const isSelected = option.value === field.value && selectedOption?.operation === option.operation;

            return (
              <BootstrapOptionCard
                key={`${option.value}-${option.operation}`}
                option={option}
                isSelected={isSelected}
                optionState={optionState}
                index={index}
                onSelect={onOptionSelect}
                onChange={field.onChange}
              />
            );
          })}
        </>
      )}
    />
  );
}
