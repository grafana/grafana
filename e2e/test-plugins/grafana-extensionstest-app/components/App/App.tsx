import { Route, Routes } from 'react-router-dom';
import { AppRootProps } from '@grafana/data';
import { ROUTES } from '../../constants';
import { AddedComponents, ExposedComponents, LegacyAPIs } from '../../pages';
import { testIds } from '../../testIds';
import { AddedLinks } from '../../pages/AddedLinks';

export function App(props: AppRootProps) {
  return (
    <div data-testid={testIds.container} style={{ marginTop: '5%' }}>
      <Routes>
        <Route path={ROUTES.LegacyAPIs} element={<LegacyAPIs />} />
        <Route path={ROUTES.ExposedComponents} element={<ExposedComponents />} />
        <Route path={ROUTES.AddedComponents} element={<AddedComponents />} />
        <Route path={ROUTES.AddedLinks} element={<AddedLinks />} />

        <Route path={'*'} element={<LegacyAPIs />} />
      </Routes>
    </div>
  );
}
