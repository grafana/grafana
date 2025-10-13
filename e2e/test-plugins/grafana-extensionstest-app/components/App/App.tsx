import { Route, Routes } from 'react-router-dom';

import { AppRootProps } from '@grafana/data';

import { ROUTES } from '../../constants';
import { AddedComponents, AddedLinks, ExposedComponents, LegacyGetters, LegacyHooks } from '../../pages';
import { testIds } from '../../testIds';

export function App(props: AppRootProps) {
  return (
    <div data-testid={testIds.container} style={{ marginTop: '5%' }}>
      <Routes>
        <Route path={ROUTES.LegacyGetters} element={<LegacyGetters />} />
        <Route path={ROUTES.LegacyHooks} element={<LegacyHooks />} />
        <Route path={ROUTES.ExposedComponents} element={<ExposedComponents />} />
        <Route path={ROUTES.AddedComponents} element={<AddedComponents />} />
        <Route path={ROUTES.AddedLinks} element={<AddedLinks />} />

        <Route path={'*'} element={<LegacyGetters />} />
      </Routes>
    </div>
  );
}
