import { v4 as uuidv4 } from 'uuid';

import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';

import { Feedback } from '../../../../apps/feedback/plugin/src/feedback/v0alpha1/feedback_object_gen';
import { Spec } from '../../../../apps/feedback/plugin/src/feedback/v0alpha1/types.spec.gen';
import { ScopedResourceClient } from '../apiserver/client';
import { ResourceForCreate, ResourceClient } from '../apiserver/types';

class K8sAPI {
  readonly server: ResourceClient<Feedback>;

  constructor() {
    this.server = new ScopedResourceClient<Feedback>({
      group: 'feedback.grafana.app',
      version: 'v0alpha1',
      resource: 'feedbacks',
    });
  }

  async createFeedback(feedback: Spec): Promise<void> {
    await withErrorHandling(async () => {
      const fullFeedback: ResourceForCreate<Feedback, string> = {
        metadata: {
          name: uuidv4(), // any better ideas?
        },
        spec: {
          kind: 'Feedback',
          apiVersion: 'feedback.grafana.app/v0alpha1',
          metadata: {
            name: '', // why is it twice?
            namespace: '',
          },
          spec: feedback, // why is spec here twice?
          status: {},
        },
      };
      await this.server.create(fullFeedback);
    });
  }
}

async function withErrorHandling(apiCall: () => Promise<void>, message = 'Feedback saved') {
  try {
    await apiCall();
    dispatch(notifyApp(createSuccessNotification(message)));
  } catch (e) {
    if (e instanceof Error) {
      dispatch(notifyApp(createErrorNotification('Unable to save feedback', e)));
    }
  }
}

export function getFeedbackAPI() {
  return new K8sAPI();
}
