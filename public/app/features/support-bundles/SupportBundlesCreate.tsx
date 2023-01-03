import React, { useCallback, useEffect, useState } from 'react';
import { useAsyncFn } from 'react-use';

import { getBackendSrv, locationService } from '@grafana/runtime';
import { Form, Button, Field, Checkbox } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

// move to types
export interface SupportBundleCreateRequest {
  collectors: string[];
}

export interface SupportBundleCollector {
  uid: string;
  displayName: string;
  description: string;
  includedByDefault: boolean;
  default: boolean;
}

export interface Props {}

const createSupportBundle = async (data: SupportBundleCreateRequest) => {
  const result = await getBackendSrv().post('/api/support-bundles', data);
  return result;
};

export const SupportBundlesCreate = ({}: Props): JSX.Element => {
  const onSubmit = useCallback(async (data) => {
    try {
      const selectedLabelsArray = Object.keys(data).filter((key) => data[key]);
      const response = await createSupportBundle({ collectors: selectedLabelsArray });
      console.info(response);
    } catch (e) {
      console.error(e);
    }

    locationService.push('/admin/support-bundles');
  }, []);

  const [components, setComponents] = useState<SupportBundleCollector[]>([]);
  // populate components from the backend
  const populateComponents = async () => {
    return await getBackendSrv().get('/api/support-bundles/collectors');
  };

  const [state, fetchComponents] = useAsyncFn(populateComponents);
  useEffect(() => {
    fetchComponents().then((res) => {
      setComponents(res);
    });
  }, [fetchComponents]);

  // turn components into a uuid -> enabled map
  const values: Record<string, boolean> = components.reduce((acc, curr) => {
    return { ...acc, [curr.uid]: curr.default };
  }, {});

  return (
    <Page navId="support-bundles" pageNav={{ text: 'Create support bundle' }}>
      <Page.Contents>
        <Page.OldNavOnly>
          <h3 className="page-sub-heading">Create support bundle</h3>
        </Page.OldNavOnly>
        {state.error && <p>{state.error}</p>}
        {!!components.length && (
          <Form defaultValues={values} onSubmit={onSubmit} validateOn="onSubmit">
            {({ register, errors }) => {
              return (
                <>
                  {components.map((component) => {
                    return (
                      <Field key={component.uid}>
                        <Checkbox
                          {...register(component.uid)}
                          label={component.displayName}
                          id={component.uid}
                          description={component.description}
                          defaultChecked={component.default}
                          disabled={component.includedByDefault}
                        />
                      </Field>
                    );
                  })}
                  <Button type="submit">Create</Button>
                </>
              );
            }}
          </Form>
        )}
      </Page.Contents>
    </Page>
  );
};

export default SupportBundlesCreate;
