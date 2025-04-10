import { Field, FieldType } from '@grafana/data';

import { SpanLinkDef } from '../../types';
import { SpanLinkType } from '../../types/links';

import { getMostRelevantLinkByAttribute } from './span-utils';

describe('trace view span utils', () => {
  describe('getMostRelevantLinkByAttribute', () => {
    const field: Field<string | null> = {
      name: 'flux-dimensions',
      type: FieldType.string,
      values: [],
      config: {
        links: [],
      },
    };

    const serviceLink: SpanLinkDef = {
      href: 'http://example.com/service',
      field,
      content: '',
      type: SpanLinkType.Traces,
      resourceAttributes: ['service.name'],
    };

    const serviceWithNamespaceLink: SpanLinkDef = {
      href: 'http://example.com/service-with-namespace',
      field,
      content: '',
      type: SpanLinkType.Traces,
      resourceAttributes: ['service.namespace', 'service.name'],
    };

    const k8sLink: SpanLinkDef = {
      href: 'http://example.com/k8s',
      field,
      content: '',
      type: SpanLinkType.Traces,
      resourceAttributes: ['k8s.cluster.name', 'k8s.namespace.name', 'k8s.deployment.name'],
    };

    const noAttributesLink: SpanLinkDef = {
      href: 'http://some.com/about',
      field,
      content: '',
      type: SpanLinkType.Traces,
    };

    const links = [serviceLink, serviceWithNamespaceLink, k8sLink, noAttributesLink];

    it('returns undefined if no links have the attribute', () => {
      const link = getMostRelevantLinkByAttribute('some.random.attribute', links);
      expect(link).toBe(undefined);
    });

    it('returns the most relevant link by attribute', () => {
      const service = getMostRelevantLinkByAttribute('service.name', links);
      expect(service).toBe(serviceWithNamespaceLink);

      const k8s = getMostRelevantLinkByAttribute('k8s.cluster.name', links);
      expect(k8s).toBe(k8sLink);
    });
  });
});
