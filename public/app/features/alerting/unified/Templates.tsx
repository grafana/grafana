import { Route, Routes } from 'react-router-dom-v5-compat';

import DuplicateMessageTemplate from './components/contact-points/DuplicateMessageTemplate';
import EditMessageTemplate from './components/contact-points/EditMessageTemplate';
import NewMessageTemplate from './components/contact-points/NewMessageTemplate';
import { withPageErrorBoundary } from './withPageErrorBoundary';

function NotificationTemplates() {
  return (
    <Routes>
      <Route path="new" element={<NewMessageTemplate />} />
      <Route path=":name/edit" element={<EditMessageTemplate />} />
      <Route path=":name/duplicate" element={<DuplicateMessageTemplate />} />
    </Routes>
  );
}

export default withPageErrorBoundary(NotificationTemplates);
