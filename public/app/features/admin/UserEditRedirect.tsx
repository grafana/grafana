import { Navigate, useParams } from 'react-router-dom-v5-compat';

// Redirects old /admin/users/edit/:uid URLs to the new tabbed page
export default function UserEditRedirect() {
  const { uid } = useParams<{ uid: string }>();
  return <Navigate to={`/admin/users/${uid}/information`} replace />;
}
