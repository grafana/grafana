import React from 'react';
import { Link } from 'react-router-dom';

import { getAppRoutes } from '../../routes/routes';
import { PageContents } from '../components/Page/PageContents';

import { RouteDescriptor } from './types';

export const RouterDebugger = () => {
  const manualRoutes: RouteDescriptor[] = [];
  return (
    <PageContents>
      <h1>Static routes</h1>
      <ul>
        {getAppRoutes().map((r, i) => {
          if (r.path.indexOf(':') > -1 || r.path.indexOf('test') > -1) {
            if (r.path.indexOf('test') === -1) {
              manualRoutes.push(r);
            }
            return null;
          }

          return (
            <li key={i}>
              <Link target="_blank" to={r.path}>
                {r.path}
              </Link>
            </li>
          );
        })}
      </ul>

      <h1>Dynamic routes - check those manually</h1>
      <ul>
        {manualRoutes.map((r, i) => {
          return (
            <li key={i}>
              <Link key={`${i}-${r.path}`} target="_blank" to={r.path}>
                {r.path}
              </Link>
            </li>
          );
        })}
      </ul>
    </PageContents>
  );
};
