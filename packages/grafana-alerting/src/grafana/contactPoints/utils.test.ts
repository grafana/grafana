import {
  ContactPointFactory,
  ContactPointMetadataAnnotationsFactory,
  EmailIntegrationFactory,
  GenericIntegrationFactory,
  SlackIntegrationFactory,
} from '../api/notifications/v0alpha1/mocks/fakes/Receivers';

import {
  getContactPointDescription,
  getContactPointInUse,
  getContactPointInUseRoutes,
  getContactPointInUseRules,
  isUsableContactPoint,
} from './utils';

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

describe('getContactPointInUseRoutes', () => {
  it('returns the route count from the annotation', () => {
    const cp = ContactPointFactory.build({
      metadata: {
        annotations: ContactPointMetadataAnnotationsFactory.build({ 'grafana.com/inUse/routes': '3' }),
      },
    });
    expect(getContactPointInUseRoutes(cp)).toBe(3);
  });

  it('returns 0 when the annotation is absent', () => {
    const cp = ContactPointFactory.build({
      metadata: {
        annotations: ContactPointMetadataAnnotationsFactory.build({ 'grafana.com/inUse/routes': undefined }),
      },
    });
    expect(getContactPointInUseRoutes(cp)).toBe(0);
  });
});

describe('getContactPointInUseRules', () => {
  it('returns the rules count from the annotation', () => {
    const cp = ContactPointFactory.build({
      metadata: {
        annotations: ContactPointMetadataAnnotationsFactory.build({ 'grafana.com/inUse/rules': '5' }),
      },
    });
    expect(getContactPointInUseRules(cp)).toBe(5);
  });

  it('returns 0 when the annotation is absent', () => {
    const cp = ContactPointFactory.build({
      metadata: {
        annotations: ContactPointMetadataAnnotationsFactory.build({ 'grafana.com/inUse/rules': undefined }),
      },
    });
    expect(getContactPointInUseRules(cp)).toBe(0);
  });
});

describe('getContactPointInUse', () => {
  it('returns both counts', () => {
    const cp = ContactPointFactory.build({
      metadata: {
        annotations: ContactPointMetadataAnnotationsFactory.build({
          'grafana.com/inUse/routes': '2',
          'grafana.com/inUse/rules': '7',
        }),
      },
    });
    expect(getContactPointInUse(cp)).toEqual({ routes: 2, rules: 7 });
  });

  it('returns zeros when both annotations are absent', () => {
    const cp = ContactPointFactory.build({
      metadata: {
        annotations: ContactPointMetadataAnnotationsFactory.build({
          'grafana.com/inUse/routes': undefined,
          'grafana.com/inUse/rules': undefined,
        }),
      },
    });
    expect(getContactPointInUse(cp)).toEqual({ routes: 0, rules: 0 });
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
    const contactPoint = ContactPointFactory.build();
    // Remove the canUse annotation to simulate it being missing
    delete contactPoint.metadata.annotations?.['grafana.com/canUse'];
    expect(isUsableContactPoint(contactPoint)).toBe(false);
  });
});
