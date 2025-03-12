import { Control, Controller } from 'react-hook-form';

import { BootstrapOptionCard } from './BootstrapOptionCard';
import { WizardFormData } from './types';

export type Target = 'instance' | 'folder';
export type Operation = 'pull' | 'migrate';

export interface ModeOption {
  value: Target;
  operation: Operation;
  label: string;
  description: string;
}

export const modeOptions: ModeOption[] = [
  {
    value: 'instance',
    operation: 'migrate',
    label: 'Migrate Instance to Repository',
    description: 'Save all Grafana resources to repository',
  },
  {
    value: 'instance',
    operation: 'pull',
    label: 'Pull from Repository to Instance',
    description: 'Pull resources from repository into this Grafana instance',
  },
  {
    value: 'folder',
    operation: 'pull',
    label: 'Pull from Repository to Folder',
    description: 'Pull repository resources into a specific folder',
  },
];

export interface OptionState {
  isDisabled: boolean;
  disabledReason?: string;
}

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
