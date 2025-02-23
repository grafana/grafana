import { ControlledCollapse, TextLink } from '@grafana/ui';

export function TokenPermissionsInfo() {
  return (
    <ControlledCollapse collapsible label="Access Token Permissions">
      <div>
        To create a new Access Token, navigate to{' '}
        <TextLink external href="https://github.com/settings/tokens">
          Personal Access Tokens
        </TextLink>{' '}
        and click &quot;Generate new token.&quot;
      </div>

      <p>Ensure that your token has the following permissions:</p>

      <p>For all repositories:</p>
      <pre>public_repo, repo:status, repo_deployment, read:packages, read:user, user:email</pre>

      <p>For GitHub projects:</p>
      <pre>read:org, read:project</pre>

      <p>An extra setting is required for private repositories:</p>
      <pre>repo (Full control of private repositories)</pre>
    </ControlledCollapse>
  );
}
