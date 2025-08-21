import { useEffect, useMemo } from 'react';

import { Combobox, ComboboxOption, Input } from '@grafana/ui';

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
    canFetchBranches,
  } = useBranchFetching({
    repositoryType,
    repositoryUrl,
    repositoryToken,
  });

  const options = useMemo<Array<ComboboxOption<string>>>(() => {
    return branches.map((branch) => ({
      label: branch.name,
      value: branch.name,
    }));
  }, [branches]);

  useEffect(() => {
    if (!value && branches.length > 0 && !loading) {
      const defaultBranch = branches.find((branch) => branch.isDefault);
      if (defaultBranch) {
        onChange(defaultBranch.name);
      }
    }
  }, [branches, value, loading, onChange]);

  if (!canFetchBranches) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        invalid={invalid}
      />
    );
  }

  const currentValue = value ? options.find((option) => option.value === value) || { value, label: value } : null;

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
