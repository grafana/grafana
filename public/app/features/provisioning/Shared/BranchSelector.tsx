import { useEffect, useMemo } from 'react';

import { Combobox, ComboboxOption } from '@grafana/ui';

import { RepoType } from '../Wizard/types';
import { useBranchFetching } from '../hooks/useBranchFetching';

interface BranchSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  repositoryType: RepoType;
  repositoryUrl: string;
  repositoryToken: string;
  createCustomValue?: boolean;
}

export function BranchSelector({
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  invalid,
  repositoryType,
  repositoryUrl,
  repositoryToken,
  createCustomValue = false,
}: BranchSelectorProps) {
  const {
    branches,
    loading,
    error: fetchError,
  } = useBranchFetching({
    repositoryType,
    repositoryUrl,
    repositoryToken,
  });

  const options = useMemo<Array<ComboboxOption<string>>>(() => {
    const branchOptions = branches.map((branch) => ({
      label: branch.name,
      value: branch.name,
    }));

    // If we have a value that's not in the branches list (custom value),
    // add it to the options so it displays properly
    if (value && !branches.some((b) => b.name === value)) {
      branchOptions.unshift({
        label: value,
        value: value,
      });
    }

    return branchOptions;
  }, [branches, value]);

  useEffect(() => {
    if (!value && branches.length > 0 && !loading) {
      const defaultBranch = branches.find((branch) => branch.isDefault);
      if (defaultBranch) {
        onChange(defaultBranch.name);
      }
    }
  }, [branches, value, loading, onChange]);

  const currentValue = value ? options.find((option) => option.value === value) : null;

  const showError = invalid || !!fetchError;

  return (
    <Combobox
      value={currentValue}
      placeholder={placeholder}
      options={options}
      onChange={(option) => onChange(option?.value || '')}
      onBlur={onBlur}
      loading={loading}
      disabled={disabled}
      invalid={showError}
      createCustomValue={createCustomValue}
      isClearable={true}
      data-testid="branch-selector"
    />
  );
}
