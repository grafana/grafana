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

const ShortUrlRedirectPage = (props: Props) => {
  const { navModel } = props;
  const [error, setError] = useState<boolean>(false);
  useEffect(() => {
    getBackendSrv()
      .get(`/goto/${props.shortLinkUid}`) //todo will returning a 302 work here?
      .then(path => alert(props.shortLinkUid)) //window.location.replace(path); or like the react-router way i guess?
      .catch(err => alert(err)); //setError(true);
  }, []);
  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={!error}>
        <span>great work idiot</span>
      </Page.Contents>
    </Page>
  );
};

const mapStateToProps = (state: StoreState) => ({
  shortLinkUid: state.location.routeParams.shortLinkUid,
});

export default connect(mapStateToProps)(ShortUrlRedirectPage);
