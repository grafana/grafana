import { Navigate, Route, Routes } from 'react-router-dom-v5-compat';

import { ROUTES } from './constants';
import { FeatureFlagsPage } from './pages/FeatureFlagsPage';
import { LabsHomePage } from './pages/LabsHomePage';

export default function Labs() {
  return (
    <Routes>
      <Route caseSensitive path="/" element={<LabsHomePage />} />
      <Route caseSensitive path={ROUTES.FeatureFlags.replace(ROUTES.Base, '')} element={<FeatureFlagsPage />} />
      <Route element={<Navigate replace to="/notfound" />} />
    </Routes>
  );
}
