import React, { FC } from 'react';
import Page from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { useSelector } from 'react-redux';
import { StoreState } from 'app/types/store';

interface Props {
  pageId: string;
  isLoading?: boolean;
}

export const AlertingPageWrapper: FC<Props> = ({ children, pageId, isLoading }) => {
  const navModel = getNavModel(
    useSelector((state: StoreState) => state.navIndex),
    pageId
  );

  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={isLoading}>{children}</Page.Contents>
    </Page>
  );
};
