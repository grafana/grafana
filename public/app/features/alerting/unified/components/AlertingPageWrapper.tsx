import React, { FC } from 'react';
import Page from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { useSelector } from 'react-redux';
import { StoreState } from 'app/types/store';

interface Props {
  isLoading?: boolean;
}

export const AlertingPageWrapper: FC<Props> = ({ children, isLoading }) => {
  const navModel = getNavModel(
    useSelector((state: StoreState) => state.navIndex),
    'alert-list'
  );

  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={isLoading}>{children}</Page.Contents>
    </Page>
  );
};
