import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { GetRepositoryRefsApiResponse, RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

interface UseBranchDropdownOptionsParams {
  repository?: RepositoryView;
  prBranch?: string;
  lastBranch?: string;
  branchData?: GetRepositoryRefsApiResponse;
}

interface BranchOption {
  label: string;
  value: string;
  description?: string;
}

function getBranchDescriptions() {
  return {
    configured: t(
      'provisioned-resource-form.save-or-delete-resource-shared-fields.suffix-configured-branch',
      'Configured branch'
    ),
    pr: t('provisioned-resource-form.save-or-delete-resource-shared-fields.suffix-pr-branch', 'Pull request branch'),
    lastUsed: t('provisioned-resource-form.save-or-delete-resource-shared-fields.suffix-last-used', 'Last branch'),
  };
}

/**
 * Hook to generate branch dropdown options with proper ordering and deduplication.
 * Order: Configured branch → PR branch → Last used branch → Other branches
 */
export const useBranchDropdownOptions = ({
  repository,
  prBranch,
  lastBranch,
  branchData,
}: UseBranchDropdownOptionsParams): BranchOption[] => {
  const descriptions = useMemo(() => getBranchDescriptions(), []);

  const options: BranchOption[] = [];
  const addedBranches = new Set<string>();

  const configuredBranch = repository?.branch;

  if (configuredBranch) {
    options.push({
      label: `${configuredBranch}`,
      value: configuredBranch,
      description: descriptions.configured,
    });
    addedBranches.add(configuredBranch);
  }

  if (prBranch && !addedBranches.has(prBranch)) {
    options.push({
      label: prBranch,
      value: prBranch,
      description: descriptions.pr,
    });
    addedBranches.add(prBranch);
  }

  if (lastBranch && !addedBranches.has(lastBranch)) {
    options.push({
      label: lastBranch,
      value: lastBranch,
      description: descriptions.lastUsed,
    });
    addedBranches.add(lastBranch);
  }

  if (branchData?.items) {
    for (const ref of branchData.items) {
      if (!addedBranches.has(ref.name)) {
        options.push({ label: ref.name, value: ref.name });
        addedBranches.add(ref.name);
      }
    }
  }

  return options;
};
