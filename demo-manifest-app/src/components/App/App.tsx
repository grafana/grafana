import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppRootProps } from '@grafana/data';

const KindsPage = React.lazy(() => import('../../pages/KindsPage'));

function App(_props: AppRootProps) {
  return (
    <Routes>
      <Route path="*" element={<KindsPage />} />
    </Routes>
  );
}

export default App;
