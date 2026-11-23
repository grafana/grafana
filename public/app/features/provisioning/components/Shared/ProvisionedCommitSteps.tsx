import { useNavigate } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { Button, LinkButton } from '@grafana/ui';

import { type ResourceKindInfo, type ResourceKindKey, resourceKindInfos } from '../../utils/resourceKinds';

import { type ProvisionedCommitOutcome, isDirectCommit } from './provisionedCommitOutcome';

interface Props {
  /**
   * The kind committed, which names the steps onto its page and its list. Omitted by an action over
   * a selection that can span kinds, where there is no one kind to name.
   */
  kindKey?: ResourceKindKey;
  outcome: ProvisionedCommitOutcome;
  /**
   * The committed resource's `metadata.name`, for the step onto its own page. Omitted by an action
   * covering many resources, which has no single page to go to.
   */
  resourceName?: string;
  /**
   * Where a commit on a branch can be previewed, for the kinds that have such a page. Only
   * dashboards do, so every other kind offers no way to view a branch commit.
   */
  branchViewUrl?: string;
  /** Closes the drawer. Every step runs it, so the drawer is never left over the page it lands on. */
  onDismiss: () => void;
}

/**
 * Where to go once a commit has landed, derived from the kind's registry entry: the pull request it
 * opens and the resource's own page. A new kind gets both from its entry, without a step of its own
 * here.
 */
export function ProvisionedCommitSteps({ kindKey, outcome, resourceName, branchViewUrl, onDismiss }: Props) {
  const navigate = useNavigate();
  // Widened from the literal registry entry, whose optional members the union hides.
  const kind: ResourceKindInfo | undefined = kindKey && resourceKindInfos[kindKey];
  const isDirect = isDirectCommit(outcome);
  // A plain git remote opens no pull request, so the way out to the server is the repository itself.
  const externalUrl = outcome.prUrl || (isDirect ? undefined : outcome.repoUrl);

  // Only a direct commit is live in Grafana: a branch commit exists on the branch alone until the
  // pull request merges, so only a kind with a preview page can show one. A delete leaves nothing,
  // and an action over many resources has no single page to offer.
  const canView = outcome.action !== 'delete' && (outcome.count ?? 1) === 1;
  const viewUrl = !canView ? undefined : isDirect ? resourceName && kind?.getRoute?.(resourceName) : branchViewUrl;

  // The drawer outlives the commit it reports, so a route it is already on leaves it over the page.
  const leaveTo = (url: string) => {
    onDismiss();
    navigate(url);
  };

  return (
    <>
      {/* Opening the pull request is what carries a branch commit forward. */}
      {externalUrl && (
        <LinkButton href={externalUrl} target="_blank" variant="primary" icon="external-link-alt">
          {outcome.prUrl
            ? t('provisioning.commit-steps.open-pull-request', 'Open pull request')
            : t('provisioning.commit-steps.open-repository', 'Open repository')}
        </LinkButton>
      )}
      {viewUrl && kind && (
        <Button variant="secondary" onClick={() => leaveTo(viewUrl)}>
          {t('provisioning.commit-steps.view', 'View {{resource}}', {
            resource: kind.getLabel({ upperFirst: false }),
          })}
        </Button>
      )}
      {/* Nothing above leads anywhere, so closing is the only step out. */}
      {!externalUrl && !viewUrl && (
        <Button variant="secondary" onClick={onDismiss}>
          {t('provisioning.commit-steps.close', 'Close')}
        </Button>
      )}
    </>
  );
}
