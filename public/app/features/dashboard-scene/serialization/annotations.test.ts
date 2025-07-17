import { AnnotationQuery } from '@grafana/data';
import { AnnotationQueryKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { transformV1ToV2AnnotationQuery, transformV2ToV1AnnotationQuery } from './annotations';

describe('V1<->V2 annotation convertions', () => {
  test('given grafana-built in annotations', () => {
    // test case
    const annotationDefinition: AnnotationQuery = {
      builtIn: 1,
      datasource: {
        type: 'grafana',
        uid: 'grafana',
      },
      enable: true,
      hide: false,
      iconColor: 'yellow',
      name: 'Annotations \u0026 Alerts',
      target: {
        // @ts-expect-error
        limit: 100,
        matchAny: false,
        tags: [],
        type: 'dashboard',
      },
      type: 'dashboard',
    };

    const expectedV2: AnnotationQueryKind = {
      kind: 'AnnotationQuery',
      spec: {
        builtIn: true,
        enable: true,
        hide: false,
        iconColor: 'yellow',
        name: 'Annotations \u0026 Alerts',
        query: {
          kind: 'DataQuery',
          group: 'grafana',
          version: 'v0',
          datasource: {
            name: 'grafana',
          },
          spec: {
            limit: 100,
            matchAny: false,
            tags: [],
            type: 'dashboard',
          },
        },
      },
    };

    const resultV2: AnnotationQueryKind = transformV1ToV2AnnotationQuery(annotationDefinition, 'grafana', 'grafana');

    expect(resultV2).toEqual(expectedV2);

    const resultV1: AnnotationQuery = transformV2ToV1AnnotationQuery(expectedV2);
    expect(resultV1).toEqual(annotationDefinition);
  });

  test('given annotations with datasource', () => {
    const annotationDefinition = {
      datasource: {
        type: 'grafana-testdata-datasource',
        uid: 'uid',
      },
      enable: true,
      hide: false,
      iconColor: 'blue',
      name: 'testdata-annos',
      target: {
        lines: 10,
        refId: 'Anno',
        scenarioId: 'annotations',
      },
    };

    const expectedV2: AnnotationQueryKind = {
      kind: 'AnnotationQuery',
      spec: {
        enable: true,
        hide: false,
        iconColor: 'blue',
        name: 'testdata-annos',
        builtIn: false,
        query: {
          kind: 'DataQuery',
          group: 'grafana-testdata-datasource',
          version: 'v0',
          datasource: {
            name: 'uid',
          },
          spec: {
            lines: 10,
            refId: 'Anno',
            scenarioId: 'annotations',
          },
        },
      },
    };

    const resultV2: AnnotationQueryKind = transformV1ToV2AnnotationQuery(
      annotationDefinition,
      'grafana-testdata-datasource',
      'uid'
    );

    expect(resultV2).toEqual(expectedV2);

    const resultV1: AnnotationQuery = transformV2ToV1AnnotationQuery(expectedV2);
    expect(resultV1).toEqual(annotationDefinition);
  });

  test('given annotations with target', () => {
    const annotationDefinition = {
      datasource: {
        type: 'prometheus',
        uid: 'uid',
      },
      enable: true,
      hide: false,
      iconColor: 'yellow',
      name: 'prom-annos',
      target: {
        expr: '{action="add_client"}',
        interval: '',
        lines: 10,
        refId: 'Anno',
        scenarioId: 'annotations',
      },
    };

    const expectedV2: AnnotationQueryKind = {
      kind: 'AnnotationQuery',
      spec: {
        enable: true,
        hide: false,
        iconColor: 'yellow',
        name: 'prom-annos',
        builtIn: false,
        query: {
          kind: 'DataQuery',
          group: 'prometheus',
          version: 'v0',
          datasource: {
            name: 'uid',
          },
          spec: {
            expr: '{action="add_client"}',
            interval: '',
            lines: 10,
            refId: 'Anno',
            scenarioId: 'annotations',
          },
        },
      },
    };

    const resultV2: AnnotationQueryKind = transformV1ToV2AnnotationQuery(annotationDefinition, 'prometheus', 'uid');
    expect(resultV2).toEqual(expectedV2);

    const resultV1: AnnotationQuery = transformV2ToV1AnnotationQuery(expectedV2);
    expect(resultV1).toEqual(annotationDefinition);
  });

  test('given annotations with non-schematised options / legacyOptions', () => {
    const annotationDefinition = {
      datasource: {
        type: 'elasticsearch',
        uid: 'uid',
      },
      enable: true,
      hide: false,
      iconColor: 'red',
      name: 'elastic - annos',
      tagsField: 'asd',
      target: {
        lines: 10,
        query: 'test query',
        refId: 'Anno',
        scenarioId: 'annotations',
      },
      textField: 'asd',
      timeEndField: 'asdas',
      timeField: 'asd',
    };

    const expectedV2: AnnotationQueryKind = {
      kind: 'AnnotationQuery',
      spec: {
        enable: true,
        hide: false,
        iconColor: 'red',
        name: 'elastic - annos',
        builtIn: false,
        query: {
          kind: 'DataQuery',
          group: 'elasticsearch',
          version: 'v0',
          datasource: {
            name: 'uid',
          },
          spec: {
            lines: 10,
            query: 'test query',
            refId: 'Anno',
            scenarioId: 'annotations',
          },
        },
        legacyOptions: {
          tagsField: 'asd',
          textField: 'asd',
          timeEndField: 'asdas',
          timeField: 'asd',
        },
      },
    };

    const resultV2: AnnotationQueryKind = transformV1ToV2AnnotationQuery(annotationDefinition, 'elasticsearch', 'uid');
    expect(resultV2).toEqual(expectedV2);

    const resultV1: AnnotationQuery = transformV2ToV1AnnotationQuery(expectedV2);
    expect(resultV1).toEqual(annotationDefinition);
  });
});
