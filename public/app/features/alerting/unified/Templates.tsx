import { Route, Routes } from 'react-router-dom-v5-compat';

import { withErrorBoundary } from '@grafana/ui';

import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import DuplicateMessageTemplate from './components/contact-points/DuplicateMessageTemplate';
import EditMessageTemplate from './components/contact-points/EditMessageTemplate';
import NewMessageTemplate from './components/contact-points/NewMessageTemplate';

const NotificationTemplates = (): JSX.Element => (
  <AlertmanagerPageWrapper
    navId="receivers"
    accessType="notification"
    pageNav={{
      id: 'templates',
      text: 'Notification templates',
      subTitle: 'Create and edit a group of notification templates',
    }}
  >
    <Routes>
      <Route path=":name/edit" element={<EditMessageTemplate />} />
      <Route path="new" element={<NewMessageTemplate />} />
      <Route path=":name/duplicate" element={<DuplicateMessageTemplate />} />
    </Routes>
  </AlertmanagerPageWrapper>
);

export default withErrorBoundary(NotificationTemplates, { style: 'page' });
