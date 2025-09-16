import { useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Trans, t } from '@grafana/i18n';
import { Button, Field, Checkbox, LinkButton, Stack, Alert } from '@grafana/ui';
import { Form } from 'app/core/components/Form/Form';
import { Page } from 'app/core/components/Page/Page';
import { StoreState } from 'app/types/store';

import { loadSupportBundleCollectors, createSupportBundle } from './state/actions';

const mapStateToProps = (state: StoreState) => {
  return {
    collectors: state.supportBundles.supportBundleCollectors,
    isLoading: state.supportBundles.createBundlePageLoading,
    loadCollectorsError: state.supportBundles.loadBundlesError,
    createBundleError: state.supportBundles.createBundleError,
  };
};

const mapDispatchToProps = {
  loadSupportBundleCollectors,
  createSupportBundle,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = ConnectedProps<typeof connector>;

export const SupportBundlesCreateUnconnected = ({
  collectors,
  isLoading,
  loadCollectorsError,
  createBundleError,
  loadSupportBundleCollectors,
  createSupportBundle,
}: Props): JSX.Element => {
  const onSubmit = (data: Record<string, boolean>) => {
    const selectedLabelsArray = Object.keys(data).filter((key) => data[key]);
    createSupportBundle({ collectors: selectedLabelsArray });
  };

  useEffect(() => {
    loadSupportBundleCollectors();
  }, [loadSupportBundleCollectors]);

  // turn components into a uuid -> enabled map
  const values: Record<string, boolean> = collectors.reduce((acc, curr) => {
    return { ...acc, [curr.uid]: curr.default };
  }, {});

  const subTitle = (
    <span>
      <Trans i18nKey="support-bundles.support-bundles-create-unconnected.sub-title">
        Choose the components for the support bundle. The support bundle will be available for 3 days after creation.
      </Trans>
    </span>
  );

  return (
    <Page
      navId="support-bundles"
      pageNav={{
        text: t(
          'support-bundles.support-bundles-create-unconnected.text.create-support-bundle',
          'Create support bundle'
        ),
      }}
      subTitle={subTitle}
    >
      <Page.Contents isLoading={isLoading}>
        {loadCollectorsError && <Alert title={loadCollectorsError} severity="error" />}
        {createBundleError && <Alert title={createBundleError} severity="error" />}
        {!!collectors.length && (
          <Form defaultValues={values} onSubmit={onSubmit} validateOn="onSubmit">
            {({ register }) => {
              return (
                <>
                  {[...collectors]
                    .sort((a, b) => a.displayName.localeCompare(b.displayName))
                    .map((component) => {
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
                  <Stack>
                    <Button type="submit">
                      <Trans i18nKey="support-bundles.support-bundles-create-unconnected.create">Create</Trans>
                    </Button>
                    <LinkButton href="/support-bundles" variant="secondary">
                      <Trans i18nKey="support-bundles.support-bundles-create-unconnected.cancel">Cancel</Trans>
                    </LinkButton>
                  </Stack>
                </>
              );
            }}
          </Form>
        )}
      </Page.Contents>
    </Page>
  );
};

export default connector(SupportBundlesCreateUnconnected);
