import React, { useEffect, useMemo, useState, useCallback } from 'react';

import { Button, RadioButtonGroup } from '@grafana/ui';

import { RepositoryView, RepositoryViewList } from '../api';

interface Props {
  onNext: () => void;
  settings?: RepositoryViewList;
  currentRepoName?: string;
  onOptionSelect: (option: ModeOption) => void;
}

interface ModeOption {
  label: string;
  value: 'instance' | 'folder';
  description: string;
}

const modeOptions: ModeOption[] = [
  {
    label: 'Pull from Repository to Instance',
    value: 'instance',
    description: 'Pull dashboards and other resources from the repository into your Grafana instance',
  },
  {
    label: 'Migrate Instance to Repository',
    value: 'instance',
    description: 'Migrate your existing Grafana instance resources into the repository',
  },
  {
    label: 'Pull from Repository to Folder',
    value: 'folder',
    description: 'Pull dashboards and other resources from the repository into a folder',
  },
];

export const BootstrapStep = ({ onNext, settings, currentRepoName, onOptionSelect }: Props) => {
  const [selectedOption, setSelectedOption] = useState<ModeOption>();

  const otherRepos = useMemo(() => {
    return settings?.items.filter((repo: RepositoryView) => repo.name !== currentRepoName) ?? [];
  }, [settings, currentRepoName]);

  const isOptionDisabled = useCallback(
    (option: ModeOption) => {
      if (selectedOption === option) {
        return false;
      }
      return otherRepos.some((repo: RepositoryView) => repo.target === option.value);
    },
    [selectedOption, otherRepos]
  );

  useEffect(() => {
    // Select the first enabled option by default
    if (!selectedOption) {
      const firstEnabled = modeOptions.find((option) => !isOptionDisabled(option));
      if (firstEnabled) {
        setSelectedOption(firstEnabled);
        onOptionSelect(firstEnabled);
      }
    }
  }, [selectedOption, onOptionSelect, isOptionDisabled]);

  const handleOptionSelect = (value: string) => {
    const option = modeOptions.find((opt) => opt.label === value);
    if (option) {
      setSelectedOption(option);
      onOptionSelect(option);
    }
  };

  return (
    <div>
      <RadioButtonGroup
        options={modeOptions.map((opt) => ({
          label: opt.label,
          value: opt.label,
          description: opt.description,
          disabled: isOptionDisabled(opt),
        }))}
        value={selectedOption?.label}
        onChange={handleOptionSelect}
      />
      <Button onClick={onNext} disabled={!selectedOption}>
        Next
      </Button>
    </div>
  );
};
