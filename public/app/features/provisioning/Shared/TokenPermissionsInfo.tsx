import { ControlledCollapse, TextLink } from '@grafana/ui';

export function TokenPermissionsInfo() {
  return (
    <ControlledCollapse collapsible label="Access Token Permissions">
      <div>
        To create a new access token, navigate to{' '}
        <TextLink external href="https://github.com/settings/personal-access-tokens/new">
          Personal access tokens
        </TextLink>{' '}
      </div>

      <p>Select the appropriate owner and repository. Then expand repository permissions, granting</p>
      <table style={{ fontSize: '2em' }}>
        <tbody>
          <tr>
            <td>Content</td>
            <td>Read and write</td>
          </tr>
          <tr>
            <td>Metadata</td>
            <td>Read only</td>
          </tr>
          <tr>
            <td>Pull requests&nbsp;&nbsp;</td>
            <td>Read and write</td>
          </tr>
          <tr>
            <td>Webhooks</td>
            <td>Read and write &nbsp;&nbsp;</td>
          </tr>
        </tbody>
      </table>
    </ControlledCollapse>
  );
}
