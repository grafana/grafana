import { Route, Routes } from 'react-router-dom';
import { AppRootProps } from '@grafana/data';
import PageOne from '../../pages/PageOne';

function App(props: AppRootProps) {
  return (
    <Routes>
      <Route path="*" element={<PageOne />} />
    </Routes>
  );
}

export default App;
