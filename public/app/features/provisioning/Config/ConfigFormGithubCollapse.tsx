import { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { config } from '@grafana/runtime';
import { Alert, ControlledCollapse, Field } from '@grafana/ui';

import { checkPublicAccess } from '../GettingStarted/features';
import { GETTING_STARTED_URL } from '../constants';

export interface ConfigFormGithubCollapseProps {
  previews: ReactElement;
}
export function ConfigFormGithubCollapse({ previews }: ConfigFormGithubCollapseProps) {
  const navigate = useNavigate();

  return (
    <ControlledCollapse label="GitHub features" isOpen={true}>
      <h3>Realtime feedback</h3>
      {checkPublicAccess() ? (
        <div>
          <Alert title={'Webhook will be created'} severity={'info'}>
            Changes in git will be quickly pulled into grafana. Pull requests can be processed.
          </Alert>
        </div>
      ) : (
        <Alert
          title={'Public URL not configured'}
          severity={'warning'}
          buttonContent={<span>Instructions</span>}
          onRemove={() => navigate(GETTING_STARTED_URL)}
        >
          Changes in git will eventually be pulled depending on the synchronization interval. Pull requests will not be
          processed
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
