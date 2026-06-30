import { type BranchTemplateVars, substituteBranchVars } from './branchName';

const MAX_PR_TITLE_LENGTH = 255;

/** Renders pullRequest.titleTemplate. Same vars as the branch name, but free text:
 *  newlines/whitespace collapsed to single spaces, trimmed, capped. '' for an empty template. */
export function renderPullRequestTitle(
  template: string | undefined | null,
  vars: BranchTemplateVars & { random: string }
): string {
  const trimmed = template?.trim();
  if (!trimmed) {
    return '';
  }
  return substituteBranchVars(trimmed, vars).replace(/\s+/g, ' ').trim().slice(0, MAX_PR_TITLE_LENGTH);
}

/** Appends the provider-specific PR-title query param to a provider PR/compare URL.
 *  Returns `url` unchanged when there is no title or no url. GitLab uses
 *  `merge_request[title]`; every other provider uses `title` (the bracket form matches the
 *  backend-built `merge_request[source_branch]=…` URL, which GitLab accepts unencoded). */
export function appendPullRequestTitleParam(
  url: string | undefined,
  repoType: string | undefined,
  title: string | undefined
): string | undefined {
  if (!url || !title) {
    return url;
  }
  const paramName = repoType === 'gitlab' ? 'merge_request[title]' : 'title';
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${paramName}=${encodeURIComponent(title)}`;
}
