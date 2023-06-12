import React, { useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { dateTimeFormat } from '@grafana/data';
import { LinkButton, Spinner, IconButton } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, StoreState } from 'app/types';

import { loadBundles, removeBundle, checkBundles } from './state/actions';

const subTitle = (
  <span>
    Support bundles allow you to easily collect and share Grafana logs, configuration, and data with the Grafana Labs
    team.
  </span>
);

const NewBundleButton = (
  <LinkButton icon="plus" href="support-bundles/create" variant="primary">
    New support bundle
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

  const hasAccess = contextSrv.hasAccess(AccessControlAction.ActionSupportBundlesCreate, contextSrv.isGrafanaAdmin);
  const hasDeleteAccess = contextSrv.hasAccess(
    AccessControlAction.ActionSupportBundlesDelete,
    contextSrv.isGrafanaAdmin
  );

  const actions = hasAccess ? NewBundleButton : undefined;

  return (
    <Page navId="support-bundles" subTitle={subTitle} actions={actions}>
      <Page.Contents isLoading={isLoading}>
        <table className="filter-table form-inline">
          <thead>
            <tr>
              <th>Created on</th>
              <th>Requested by</th>
              <th>Expires</th>
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
                    Download
                  </LinkButton>
                </th>
                <th>
                  {hasDeleteAccess && (
                    <IconButton
                      onClick={() => removeBundle(bundle.uid)}
                      name="trash-alt"
                      variant="destructive"
                      tooltip="Remove bundle"
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
