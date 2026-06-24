import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption, Field } from '@grafana/ui';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

interface RepositorySelectProps {
  /** Configured repositories to choose from. */
  repositories: RepositoryView[];
  /** Selected repository name. `undefined`/empty leaves nothing selected — the resource is stored in Grafana. */
  value?: string;
  onChange: (repositoryName: string) => void;
  /** Render the selection read-only — the value is visible but can't be changed. */
  readOnly?: boolean;
  /** Overrides the default field description shown when the selector is editable. */
  description?: string;
  /** Overrides the default reason shown when the selector is read-only. */
  disabledReason?: string;
  id?: string;
}

/**
 * Selects one of the configured provisioning repositories. No selection means the resource is
 * stored in Grafana rather than committed to a repository. Resolve the repository list with
 * {@link useResourceRepositorySelection} (which also gates on the resource kind's availability).
 */
export function RepositorySelect({
  repositories,
  value,
  onChange,
  readOnly = false,
  description,
  disabledReason,
  id = 'repository-select',
}: RepositorySelectProps) {
  const fieldDescription = readOnly
    ? (disabledReason ??
      t(
        'provisioning.repository-select.disabled-reason',
        "The storage location can't be changed after the resource is created."
      ))
    : (description ??
      t(
        'provisioning.repository-select.description',
        'Pick a repository to store this resource in version control, or leave it empty to keep it in Grafana.'
      ));

  const options = useMemo<Array<ComboboxOption<string>>>(() => {
    const repoOptions = repositories.map((repo) => ({ label: repo.title || repo.name, value: repo.name }));
    // Keep a selected-but-missing repository (orphaned / inaccessible) visible so the value still renders.
    if (value && !repoOptions.some((option) => option.value === value)) {
      repoOptions.push({ label: value, value });
    }
    return repoOptions;
  }, [repositories, value]);

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
        isClearable
        placeholder={t('provisioning.repository-select.placeholder', 'Select a repository')}
        onChange={(option) => onChange(option?.value ?? '')}
      />
    </Field>
  );
}
