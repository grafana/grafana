import { Trans } from '@grafana/i18n';

export function BranchValidationError() {
  return (
    <>
      <Trans i18nKey="dashboard-scene.branch-validation-error.invalid-branch-name">Invalid branch name.</Trans>
      <ul style={{ padding: '0 20px' }}>
        <li>
          <Trans i18nKey="dashboard-scene.branch-validation-error.cannot-start-with">
            It cannot start with '/' or end with '/', '.', or whitespace.
          </Trans>
        </li>
        <li>
          <Trans i18nKey="dashboard-scene.branch-validation-error.it-cannot-contain-or">
            It cannot contain '//' or '..'.
          </Trans>
        </li>
        <li>
          <Trans i18nKey="dashboard-scene.branch-validation-error.cannot-contain-invalid-characters">
            It cannot contain invalid characters: '~', '^', ':', '?', '*', '[', '\\', or ']'.
          </Trans>
        </li>
        <li>
          <Trans i18nKey="dashboard-scene.branch-validation-error.least-valid-character">
            It must have at least one valid character.
          </Trans>
        </li>
      </ul>
    </>
  );
}
