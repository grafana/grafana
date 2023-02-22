import Combokeys from 'combokeys';
import React, { useEffect, useState } from 'react';
import { Features, ToggleFeatures } from 'react-enable';

import { NavModelItem } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';

import FEATURES from '../features';

interface Props {
  pageId: string;
  isLoading?: boolean;
  pageNav?: NavModelItem;
}

const combokeys = new Combokeys(document.body);

export const AlertingPageWrapper = ({ children, pageId, pageNav, isLoading }: React.PropsWithChildren<Props>) => {
  const [showFeatureToggle, setShowFeatureToggles] = useState(false);

  useEffect(() => {
    combokeys.bind('ctrl+1', () => {
      setShowFeatureToggles((show) => !show);
    });

    return () => {
      combokeys.unbind('ctrl+1');
    };
  }, [showFeatureToggle]);

  return (
    <Features features={FEATURES}>
      <Page pageNav={pageNav} navId={pageId}>
        <Page.Contents isLoading={isLoading}>{children}</Page.Contents>
      </Page>
      {showFeatureToggle ? <ToggleFeatures defaultOpen={true} /> : null}
    </Features>
  );
};
