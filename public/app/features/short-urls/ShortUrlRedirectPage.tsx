// Libraries
import React, { useEffect, useState } from 'react';
import { connect } from 'react-redux';

import { NavModel } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

import Page from 'app/core/components/Page/Page';
import { StoreState } from 'app/types';

export interface Props {
  navModel: NavModel;
  shortLinkUid: string;
}

export const ShortUrlRedirectPage = (props: Props) => {
  const { navModel } = props;
  const [error, setError] = useState<Error | undefined>();
  useEffect(() => {
    getBackendSrv()
      .get(`/api/goto/${props.shortLinkUid}`)
      .then(path => (window.location.href = path))
      .catch(setError);
  }, []);
  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={!error}>
        {error && <span>Unable to resolve short URL: {props.shortLinkUid}</span>}
      </Page.Contents>
    </Page>
  );
};

const mapStateToProps = (state: StoreState) => ({
  shortLinkUid: state.location.routeParams.shortLinkUid,
});

export default connect(mapStateToProps)(ShortUrlRedirectPage);
