import { useNavigate } from 'react-router-dom-v5-compat';

import { config } from '@grafana/runtime';
import { Alert, ControlledCollapse, Field } from '@grafana/ui';

import { checkPublicAccess } from './Setup/utils';
import { PROVISIONING_URL } from './constants';

export interface ConfigFormGithubCollpaseProps {
  previews: React.ReactElement;
}
export function ConfigFormGithubCollpase({ previews }: ConfigFormGithubCollpaseProps) {
  const navigate = useNavigate();

  return (
    <ControlledCollapse label="GitHub features" isOpen={true}>
      <h3>Realtime feedback</h3>
      {checkPublicAccess() ? (
        <div>
          <Alert title={'Webhook will be created'} severity={'info'} />
        </div>
      ) : (
        <Alert
          title={'Public URL not configured'}
          severity={'warning'}
          buttonContent={<span>Instructions</span>}
          onRemove={() => navigate(`${PROVISIONING_URL}/setup`)}
        >
          GitHub webhooks require running grafana with a public URL.
        </Alert>
      )}

      <h3>Pull Request image previews</h3>
      {!config.rendererAvailable && (
        <Alert
          title={'Image renderer not configured'}
          severity={'warning'}
          buttonContent={<span>Instructions</span>}
          onRemove={() => window.open('https://grafana.com/grafana/plugins/grafana-image-renderer/', '_blank')}
        >
          When the image renderer is configured, pull requests can see preview images
        </Alert>
      )}

      <Field
        label={'Attach dashboard previews to pull requests'}
        description={
          <span>
            Render before/after images and link them to the pull request.
            <br />
            NOTE! this will render dashboards into an image that can be access by a public URL
          </span>
        }
      >
        {previews}
      </Field>
    </ControlledCollapse>
  );
}
