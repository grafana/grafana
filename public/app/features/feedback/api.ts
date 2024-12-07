import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';

import { Spec as FeedbackSpec } from '../../../../apps/feedback/plugin/src/feedback/v0alpha1/types.spec.gen';
import { ScopedResourceClient } from '../apiserver/client';
import { ResourceForCreate, ResourceClient } from '../apiserver/types';

class K8sAPI {
  private readonly server: ResourceClient<FeedbackSpec>;

  constructor() {
    this.server = new ScopedResourceClient<FeedbackSpec>({
      group: 'feedback.grafana.app',
      version: 'v0alpha1',
      resource: 'feedbacks',
    });
  }

  // returns back true when request is successful, false when not
  async createFeedback(feedback: FeedbackSpec): Promise<boolean> {
    return await withErrorHandling(async () => {
      const fullFeedback: ResourceForCreate<FeedbackSpec, string> = {
        metadata: {
          generateName: 'feedback-', // the prefix. apiserver will generate the trailing random characters.
        },
        spec: {
          ...feedback,
        },
      };

      await this.server.create(fullFeedback);
    });
  }
}

async function withErrorHandling(
  apiCall: () => Promise<void>,
  message = 'Your feedback was received. Thank you!'
): Promise<boolean> {
  try {
    await apiCall();
    dispatch(notifyApp(createSuccessNotification(message)));
    return true;
  } catch (e) {
    if (e instanceof Error) {
      dispatch(notifyApp(createErrorNotification('Unable to save feedback', e)));
    }
    return false;
  }
}

export function getFeedbackAPI() {
  return new K8sAPI();
}
