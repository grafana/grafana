import { Navigate, useParams } from 'react-router-dom-v5-compat';

// Redirects old /org/teams/edit/:uid URLs to the new tabbed page
export default function TeamEditRedirect() {
  const { uid, page } = useParams<{ uid: string; page?: string }>();
  const target = page ? `/org/teams/${uid}/${page}` : `/org/teams/${uid}/members`;
  return <Navigate to={target} replace />;
}
