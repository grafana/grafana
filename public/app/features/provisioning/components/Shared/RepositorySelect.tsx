import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption, Field } from '@grafana/ui';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

interface RepositorySelectProps {
  /** Configured repositories to choose from. */
  repositories: RepositoryView[];
  /** Selected repository name. Empty string selects the "no repository" option (when shown). */
  value: string;
  onChange: (repositoryName: string) => void;
  /** Show a leading "no repository" option (empty value) for saving to Grafana instead of a repository. */
  includeNoneOption?: boolean;
  /** Render the selection read-only — the value is visible but can't be changed. */
  readOnly?: boolean;
  /** Overrides the default field description. */
  description?: string;
  id?: string;
}

/**
 * Selects one of the configured provisioning repositories. Resolve the repository list with
 * {@link useResourceRepositorySelection} (which also gates on the resource kind's availability).
 */
export function RepositorySelect({
  repositories,
  value,
  onChange,
  includeNoneOption = false,
  readOnly = false,
  description,
  id = 'repository-select',
}: RepositorySelectProps) {
  const fieldDescription =
    description ??
    t(
      'provisioning.repository-select.description',
      'Save this resource to a repository instead of Grafana. The repository cannot be changed after the resource is created.'
    );

  const options = useMemo<Array<ComboboxOption<string>>>(() => {
    const repoOptions = repositories.map((repo) => ({ label: repo.title || repo.name, value: repo.name }));
    // Keep a selected-but-missing repository (orphaned / inaccessible) visible so the value still renders.
    if (value && !repoOptions.some((option) => option.value === value)) {
      repoOptions.push({ label: value, value });
    }
    if (includeNoneOption) {
      const noneOption = {
        label: t('provisioning.repository-select.none-option', 'Grafana (no repository)'),
        value: '',
      };
      return [noneOption, ...repoOptions];
    }
    return repoOptions;
  }, [repositories, value, includeNoneOption]);

  return (
    <Field
      noMargin
      htmlFor={id}
      label={t('provisioning.repository-select.label', 'Repository')}
      description={fieldDescription}
    >
      <Combobox
        id={id}
        options={options}
        value={value}
        disabled={readOnly}
        onChange={(option) => onChange(option?.value ?? '')}
      />
    </Field>
  );
}
