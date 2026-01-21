import {
  ContactPointFactory,
  ContactPointMetadataAnnotationsFactory,
  EmailIntegrationFactory,
  GenericIntegrationFactory,
  SlackIntegrationFactory,
} from '../api/notifications/v0alpha1/mocks/fakes/Receivers';

import { getContactPointDescription, isUsableContactPoint } from './utils';

describe('getContactPointDescription', () => {
  it('should show description for single integration', () => {
    const contactPoint = ContactPointFactory.build({
      spec: {
        integrations: [SlackIntegrationFactory.build()],
      },
    });
    expect(getContactPointDescription(contactPoint)).toBe('slack');
  });

  it('should show description for mixed contact points', () => {
    const contactPoint = ContactPointFactory.build({
      spec: {
        integrations: [EmailIntegrationFactory.build(), SlackIntegrationFactory.build()],
      },
    });
    expect(getContactPointDescription(contactPoint)).toBe('email, slack');
  });

  it('should show description for several of the same type', () => {
    const contactPoint = ContactPointFactory.build({
      spec: {
        integrations: EmailIntegrationFactory.buildList(3),
      },
    });
    expect(getContactPointDescription(contactPoint)).toBe('email (3)');
  });

  it('should show description for empty contact point', () => {
    const contactPoint = ContactPointFactory.build({ spec: { integrations: [] } });
    expect(getContactPointDescription(contactPoint)).toBe('<empty contact point>');
  });

  it('should show description for generic / unknown contact point integration', () => {
    const contactPoint = ContactPointFactory.build({
      spec: { integrations: [GenericIntegrationFactory.build({ type: 'generic' })] },
    });
    expect(getContactPointDescription(contactPoint)).toBe('generic');
  });
});

describe('isUsableContactPoint', () => {
  it('should return true when canUse annotation is true', () => {
    const contactPoint = ContactPointFactory.build({
      metadata: {
        annotations: ContactPointMetadataAnnotationsFactory.build({
          'grafana.com/canUse': 'true',
        }),
      },
    });
    expect(isUsableContactPoint(contactPoint)).toBe(true);
  });

  it('should return false when canUse annotation is false', () => {
    const contactPoint = ContactPointFactory.build({
      metadata: {
        annotations: ContactPointMetadataAnnotationsFactory.build({
          'grafana.com/canUse': 'false',
        }),
      },
    });
    expect(isUsableContactPoint(contactPoint)).toBe(false);
  });

  it('should return false when canUse annotation is missing', () => {
    const contactPoint = ContactPointFactory.build({
      metadata: {
        annotations: {},
      },
    });
    expect(isUsableContactPoint(contactPoint)).toBe(false);
  });
});
