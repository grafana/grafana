import { useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { dateTimeFormat } from '@grafana/data';
import { LinkButton, Spinner, IconButton } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { Trans, t } from 'app/core/internationalization';
import { AccessControlAction, StoreState } from 'app/types';

import { loadBundles, removeBundle, checkBundles } from './state/actions';

const NewBundleButton = (
  <LinkButton icon="plus" href="support-bundles/create" variant="primary">
    <Trans i18nKey="support-bundles.new-bundle-button.new-support-bundle">New support bundle</Trans>
  </LinkButton>
);

const mapStateToProps = (state: StoreState) => {
  return {
    supportBundles: state.supportBundles.supportBundles,
    isLoading: state.supportBundles.isLoading,
  };
};

const mapDispatchToProps = {
  loadBundles,
  removeBundle,
  checkBundles,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = ConnectedProps<typeof connector>;

const SupportBundlesUnconnected = ({ supportBundles, isLoading, loadBundles, removeBundle, checkBundles }: Props) => {
  const isPending = supportBundles.some((b) => b.state === 'pending');

  useEffect(() => {
    loadBundles();
  }, [loadBundles]);

  useEffect(() => {
    if (isPending) {
      checkBundles();
    }
  });

  const hasAccess = contextSrv.hasPermission(AccessControlAction.ActionSupportBundlesCreate);
  const hasDeleteAccess = contextSrv.hasPermission(AccessControlAction.ActionSupportBundlesDelete);

  const actions = hasAccess ? NewBundleButton : undefined;

  const subTitle = (
    <span>
      <Trans i18nKey="support-bundles.support-bundles-unconnected.sub-title">
        Support bundles allow you to easily collect and share Grafana logs, configuration, and data with the Grafana
        Labs team.
      </Trans>
    </span>
  );

  return (
    <Page navId="support-bundles" subTitle={subTitle} actions={actions}>
      <Page.Contents isLoading={isLoading}>
        <table className="filter-table form-inline">
          <thead>
            <tr>
              <th>
                <Trans i18nKey="support-bundles.support-bundles-unconnected.created-on">Created on</Trans>
              </th>
              <th>
                <Trans i18nKey="support-bundles.support-bundles-unconnected.requested-by">Requested by</Trans>
              </th>
              <th>
                <Trans i18nKey="support-bundles.support-bundles-unconnected.expires">Expires</Trans>
              </th>
              <th style={{ width: '32px' }} />
              <th style={{ width: '1%' }} />
              <th style={{ width: '1%' }} />
            </tr>
          </thead>
          <tbody>
            {supportBundles?.map((bundle) => (
              <tr key={bundle.uid}>
                <th>{dateTimeFormat(bundle.createdAt * 1000)}</th>
                <th>{bundle.creator}</th>
                <th>{dateTimeFormat(bundle.expiresAt * 1000)}</th>
                <th>{bundle.state === 'pending' && <Spinner />}</th>
                <th>
                  <LinkButton
                    fill="outline"
                    disabled={bundle.state !== 'complete'}
                    target={'_self'}
                    href={`/api/support-bundles/${bundle.uid}`}
                  >
                    <Trans i18nKey="support-bundles.support-bundles-unconnected.download">Download</Trans>
                  </LinkButton>
                </th>
                <th>
                  {hasDeleteAccess && (
                    <IconButton
                      onClick={() => removeBundle(bundle.uid)}
                      name="trash-alt"
                      variant="destructive"
                      tooltip={t('support-bundles.support-bundles-unconnected.tooltip-remove-bundle', 'Remove bundle')}
                    />
                  )}
                </th>
              </tr>
            ))}
          </tbody>
        </table>
      </Page.Contents>
    </Page>
  );
};

export default connector(SupportBundlesUnconnected);
