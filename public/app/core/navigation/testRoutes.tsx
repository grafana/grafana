import React from 'react';
import { Link, NavLink } from 'react-router-dom';

import { RouterDebugger } from './RouterDebugger';
import { RouteDescriptor } from './types';

export const testRoutes: RouteDescriptor[] = [
  {
    path: '/test1',
    component: () => (
      <>
        <h1>Test1</h1>
        <Link to={'/test2'}>Test2 link</Link>
        <NavLink to={'/test2'}>Test2 navlink</NavLink>
      </>
    ),
  },
  {
    path: '/test2',
    component: () => (
      <>
        <h1>Test2 </h1>
        <Link to={'/test1'}>Test1 link</Link>
        <NavLink to={'/test1'}>Test1 navlink</NavLink>
      </>
    ),
  },
  {
    path: '/router-debug',
    component: RouterDebugger,
  },
];
