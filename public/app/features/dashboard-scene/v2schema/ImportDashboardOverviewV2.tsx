import { useState } from 'react';

import { locationUtil } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { AnnotationQueryKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { Form } from 'app/core/components/Form/Form';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { clearLoadedDashboard } from 'app/features/manage-dashboards/state/actions';
import { useDispatch, useSelector, StoreState } from 'app/types';

import { ImportDashboardFormV2 } from './ImportDashboardFormV2';

const IMPORT_FINISHED_EVENT_NAME = 'dashboard_import_imported';

export function ImportDashboardOverviewV2() {
  const [uidReset, setUidReset] = useState(false);
  const dispatch = useDispatch();

  // Get state from Redux store
  const searchObj = locationService.getSearchObject();
  const dashboard = useSelector((state: StoreState) => state.importDashboard.dashboard as DashboardV2Spec);
  const inputs = useSelector((state: StoreState) => state.importDashboard.inputs);
  const folder = searchObj.folderUid ? { uid: String(searchObj.folderUid) } : { uid: '' };

  function onUidReset() {
    setUidReset(true);
  }

  function onCancel() {
    dispatch(clearLoadedDashboard());
  }

  async function onSubmit(form: SaveDashboardCommand<DashboardV2Spec>) {
    reportInteraction(IMPORT_FINISHED_EVENT_NAME);

    const dashboardWithDataSources: DashboardV2Spec = {
      ...dashboard,
      title: form.dashboard.title,
      annotations: dashboard.annotations?.map((annotation: AnnotationQueryKind) => {
        if (annotation.spec.query?.kind) {
          const dsType = annotation.spec.query.kind;
          if (form[`datasource-${dsType}` as keyof typeof form]) {
            const ds = form[`datasource-${dsType}` as keyof typeof form] as { uid: string; type: string };
            return {
              ...annotation,
              spec: {
                ...annotation.spec,
                datasource: {
                  uid: ds.uid,
                  type: ds.type,
                },
              },
            };
          }
        }
        return annotation;
      }),
      variables: dashboard.variables?.map((variable) => {
        if (variable.kind === 'QueryVariable') {
          if (variable.spec.query?.kind) {
            const dsType = variable.spec.query.kind;
            if (form[`datasource-${dsType}` as keyof typeof form]) {
              const ds = form[`datasource-${dsType}` as keyof typeof form] as { uid: string; type: string };
              return {
                ...variable,
                spec: {
                  ...variable.spec,
                  datasource: {
                    ...variable.spec.datasource,
                    uid: ds.uid,
                    type: ds.type,
                  },
                  options: [],
                  current: {
                    text: '',
                    value: '',
                  },
                  refresh: 'onDashboardLoad',
                },
              };
            }
          }
        } else if (variable.kind === 'DatasourceVariable') {
          return {
            ...variable,
            spec: {
              ...variable.spec,
              current: {
                text: '',
                value: '',
              },
            },
          };
        }
        return variable;
      }),
      elements: Object.fromEntries(
        Object.entries(dashboard.elements).map(([key, element]) => {
          if (element.kind === 'Panel') {
            const panel = { ...element.spec };
            if (panel.data?.kind === 'QueryGroup') {
              const newQueries = panel.data.spec.queries.map((query: any) => {
                if (query.kind === 'PanelQuery') {
                  const queryType = query.spec.query?.kind;
                  // Match datasource by query kind
                  if (queryType && form[`datasource-${queryType}` as keyof typeof form]) {
                    const ds = form[`datasource-${queryType}` as keyof typeof form] as { uid: string; type: string };
                    return {
                      ...query,
                      spec: {
                        ...query.spec,
                        datasource: {
                          uid: ds.uid,
                          type: ds.type,
                        },
                      },
                    };
                  }
                }
                return query;
              });
              panel.data = {
                ...panel.data,
                spec: {
                  ...panel.data.spec,
                  queries: newQueries,
                },
              };
            }
            return [
              key,
              {
                kind: element.kind,
                spec: panel,
              },
            ];
          }
          return [key, element];
        })
      ),
    };

    const result = await getDashboardAPI('v2').saveDashboard({
      ...form,
      dashboard: dashboardWithDataSources,
    });

    if (result.url) {
      const dashboardUrl = locationUtil.stripBaseFromUrl(result.url);
      locationService.push(dashboardUrl);
    }
  }

  return (
    <>
      <Form<SaveDashboardCommand<DashboardV2Spec> & { [key: `datasource-${string}`]: string }>
        onSubmit={onSubmit}
        defaultValues={{ dashboard, k8s: { annotations: { 'grafana.app/folder': folder.uid } } }}
        validateOnMount
        validateOn="onChange"
      >
        {({ register, errors, control, watch, getValues }) => (
          <ImportDashboardFormV2
            register={register}
            inputs={inputs}
            errors={errors}
            control={control}
            getValues={getValues}
            uidReset={uidReset}
            onCancel={onCancel}
            onUidReset={onUidReset}
            onSubmit={onSubmit}
            watch={watch}
          />
        )}
      </Form>
    </>
  );
}
