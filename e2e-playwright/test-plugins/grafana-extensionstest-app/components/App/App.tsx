import { Route, Routes } from 'react-router-dom';

import { AppRootProps } from '@grafana/data';

import { ROUTES } from '../../constants';
import { AddedComponents, AddedLinks, ExposedComponents } from '../../pages';
import { testIds } from '../../testIds';

export function App(props: AppRootProps) {
  return (
    <div data-testid={testIds.container} style={{ marginTop: '5%' }}>
      <Routes>
        <Route path={ROUTES.ExposedComponents} element={<ExposedComponents />} />
        <Route path={ROUTES.AddedComponents} element={<AddedComponents />} />
        <Route path={ROUTES.AddedLinks} element={<AddedLinks />} />

        <Route path={'*'} element={<ExposedComponents />} />
      </Routes>
    </div>
  );
}
