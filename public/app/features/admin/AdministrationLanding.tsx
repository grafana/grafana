import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom-v5-compat';

import { locationUtil } from '@grafana/data';
import { NavLandingPage } from 'app/core/components/NavLandingPage/NavLandingPage';
import { useSelector } from 'app/types/store';

interface Props {
  navId: string;
  header?: ReactNode;
}

// Administration's section nav lists Default preferences first, and the nav tree
// then points Administration and General there instead of at a landing page
export function AdministrationLanding({ navId, header }: Props) {
  const { pathname } = useLocation();
  const url = useSelector((state) => state.navIndex[navId]?.url);
  const target = url ? locationUtil.stripBaseFromUrl(url) : undefined;

  if (target && target !== pathname) {
    return <Navigate replace to={target} />;
  }
  return <NavLandingPage navId={navId} header={header} />;
}
