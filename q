[1mdiff --git a/public/app/plugins/datasource/grafana/specs/datasource.test.ts b/public/app/plugins/datasource/grafana/specs/datasource.test.ts[m
[1mdeleted file mode 100644[m
[1mindex db1743a2d2..0000000000[m
[1m--- a/public/app/plugins/datasource/grafana/specs/datasource.test.ts[m
[1m+++ /dev/null[m
[36m@@ -1,91 +0,0 @@[m
[31m-import { DataSourceInstanceSettings, dateTime } from '@grafana/data';[m
[31m-[m
[31m-import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__[m
[31m-import { GrafanaDatasource } from '../datasource';[m
[31m-[m
[31m-jest.mock('@grafana/runtime', () => ({[m
[31m-  ...((jest.requireActual('@grafana/runtime') as unknown) as object),[m
[31m-  getBackendSrv: () => backendSrv,[m
[31m-}));[m
[31m-[m
[31m-jest.mock('app/features/templating/template_srv', () => ({[m
[31m-  replace: (val: string) => {[m
[31m-    return val.replace('$var2', 'replaced__delimiter__replaced2').replace('$var', 'replaced');[m
[31m-  },[m
[31m-}));[m
[31m-[m
[31m-describe('grafana data source', () => {[m
[31m-  const getMock = jest.spyOn(backendSrv, 'get');[m
[31m-[m
[31m-  beforeEach(() => {[m
[31m-    jest.clearAllMocks();[m
[31m-  });[m
[31m-[m
[31m-  describe('when executing an annotations query', () => {[m
[31m-    let calledBackendSrvParams: any;[m
[31m-    let ds: GrafanaDatasource;[m
[31m-    beforeEach(() => {[m
[31m-      getMock.mockImplementation((url: string, options: any) => {[m
[31m-        calledBackendSrvParams = options;[m
[31m-        return Promise.resolve([]);[m
[31m-      });[m
[31m-[m
[31m-      ds = new GrafanaDatasource({} as DataSourceInstanceSettings);[m
[31m-    });[m
[31m-[m
[31m-    describe('with tags that have template variables', () => {[m
[31m-      const options = setupAnnotationQueryOptions({ tags: ['tag1:$var'] });[m
[31m-[m
[31m-      beforeEach(() => {[m
[31m-        return ds.annotationQuery(options);[m
[31m-      });[m
[31m-[m
[31m-      it('should interpolate template variables in tags in query options', () => {[m
[31m-        expect(calledBackendSrvParams.tags[0]).toBe('tag1:replaced');[m
[31m-      });[m
[31m-    });[m
[31m-[m
[31m-    describe('with tags that have multi value template variables', () => {[m
[31m-      const options = setupAnnotationQueryOptions({ tags: ['$var2'] });[m
[31m-[m
[31m-      beforeEach(() => {[m
[31m-        return ds.annotationQuery(options);[m
[31m-      });[m
[31m-[m
[31m-      it('should interpolate template variables in tags in query options', () => {[m
[31m-        expect(calledBackendSrvParams.tags[0]).toBe('replaced');[m
[31m-        expect(calledBackendSrvParams.tags[1]).toBe('replaced2');[m
[31m-      });[m
[31m-    });[m
[31m-[m
[31m-    describe('with type dashboard', () => {[m
[31m-      const options = setupAnnotationQueryOptions([m
[31m-        {[m
[31m-          type: 'dashboard',[m
[31m-          tags: ['tag1'],[m
[31m-        },[m
[31m-        { id: 1 }[m
[31m-      );[m
[31m-[m
[31m-      beforeEach(() => {[m
[31m-        return ds.annotationQuery(options);[m
[31m-      });[m
[31m-[m
[31m-      it('should remove tags from query options', () => {[m
[31m-        expect(calledBackendSrvParams.tags).toBe(undefined);[m
[31m-      });[m
[31m-    });[m
[31m-  });[m
[31m-});[m
[31m-[m
[31m-function setupAnnotationQueryOptions(annotation: { tags: string[]; type?: string }, dashboard?: { id: number }) {[m
[31m-  return {[m
[31m-    annotation,[m
[31m-    dashboard,[m
[31m-    range: {[m
[31m-      from: dateTime(1432288354),[m
[31m-      to: dateTime(1432288401),[m
[31m-    },[m
[31m-    rangeRaw: { from: 'now-24h', to: 'now' },[m
[31m-  };[m
[31m-}[m
