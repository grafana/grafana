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
  /** Overrides the default field description. */
  description?: string;
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
  id = 'repository-select',
}: RepositorySelectProps) {
  const fieldDescription =
    description ??
    t(
      'provisioning.repository-select.description',
      "Pick a repository to store this resource in version control and sync it from there, or leave it empty to keep it in Grafana. This can't be changed after the resource is created."
    );

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
        // Empty string means "no repository"; pass undefined so the Combobox shows the placeholder
        // (a clearable Combobox treats "" as a real selected value).
        value={value || undefined}
        disabled={readOnly}
        isClearable
        placeholder={t('provisioning.repository-select.placeholder', 'Select a repository')}
        onChange={(option) => onChange(option?.value ?? '')}
      />
    </Field>
  );
}
