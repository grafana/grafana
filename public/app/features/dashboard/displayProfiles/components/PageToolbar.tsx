import React, { ReactElement } from 'react';
import { PageToolbar, PageToolbarProps } from '@grafana/ui';
import { useDisplayProfile } from '../state/hooks';
import { getConfig } from 'app/core/config';
import { DisplayProfileMode } from '../types';

export function PageToolbarWithDisplayProfile(props: PageToolbarProps): ReactElement {
  const { dashNav } = useDisplayProfile();
  const { title } = dashNav;

  if (!getConfig().featureToggles.customKiosk) {
    return <PageToolbar {...props} />;
  }

  const hideToolbar = !Object.values(dashNav).find((mode) => mode !== DisplayProfileMode.hidden);

  if (hideToolbar) {
    return <div style={{ marginTop: '16px' }} />;
  }

  switch (title) {
    case DisplayProfileMode.hidden: {
      return (
        <PageToolbar
          {...props}
          title={''}
          titleHref={undefined}
          onGoBack={undefined}
          parent={undefined}
          parentHref={undefined}
          pageIcon={undefined}
        />
      );
    }

    default: {
      return <PageToolbar {...props} />;
    }
  }
}
