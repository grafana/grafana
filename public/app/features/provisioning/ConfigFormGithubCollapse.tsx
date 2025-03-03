import { config } from '@grafana/runtime';
import { Alert, ControlledCollapse, Field } from '@grafana/ui';

import { checkPublicAccess } from './Setup/utils';

export interface ConfigFormGithubCollpaseProps {
  previews: React.ReactElement;
}
export function ConfigFormGithubCollpase({ previews }: ConfigFormGithubCollpaseProps) {
  return (
    <ControlledCollapse label="Realtime support" isOpen={true}>
      {!checkPublicAccess() && <Alert title={'GitHub webhooks require a public URL'} severity={'warning'} />}

      {!config.rendererAvailable && (
        <Alert
          title={'Image renderer not configured'}
          severity={'warning'}
          buttonContent={<span>See documentation</span>}
          onRemove={() => window.open('https://grafana.com/grafana/plugins/grafana-image-renderer/', '_blank')}
        >
          When the image renderer is configured, pull requests can see preview images
        </Alert>
      )}

      <Field
        label={'Attach dashboard previews to pull requests'}
        disabled={!config.rendererAvailable}
        description={
          <span>
            Render before/after images and link them to the pull request.
            <br />
            NOTE! these will be public URLs!!!"
          </span>
        }
      >
        {previews}
      </Field>
    </ControlledCollapse>
  );
}
