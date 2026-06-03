import { Navigate } from 'react-router-dom-v5-compat';

export default function BookmarksRedirect() {
  return <Navigate to="/profile" replace />;
}
