import Mousetrap from 'mousetrap';
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

const SHOW_TOGGLES_KEY_COMBO = 'ctrl+1';
const combokeys = new Mousetrap(document.body);

export const AlertingPageWrapper = ({ children, pageId, pageNav, isLoading }: React.PropsWithChildren<Props>) => {
  const [showFeatureToggle, setShowFeatureToggles] = useState(false);

  useEffect(() => {
    combokeys.bind(SHOW_TOGGLES_KEY_COMBO, () => {
      setShowFeatureToggles((show) => !show);
    });

    return () => {
      combokeys.unbind(SHOW_TOGGLES_KEY_COMBO);
    };
  }, []);

  return (
    <Features features={FEATURES}>
      <Page pageNav={pageNav} navId={pageId}>
        <Page.Contents isLoading={isLoading}>{children}</Page.Contents>
      </Page>
      {showFeatureToggle ? <ToggleFeatures defaultOpen={true} /> : null}
    </Features>
  );
};
