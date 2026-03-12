import { Navigate, useParams } from 'react-router-dom-v5-compat';

// Redirects old /org/serviceaccounts/:id URLs to the new tabbed page
export default function ServiceAccountRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/org/serviceaccounts/edit/${id}/information`} replace />;
}
