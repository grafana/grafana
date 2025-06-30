import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppRootProps } from '@grafana/data';

const MainPage = React.lazy(() => import('../../pages/MainPage'));

function App(props: AppRootProps) {
  return (
    <Routes>
      {/* Default page */}
      <Route path="*" element={<MainPage />} />
    </Routes>
  );
}

export default App;
